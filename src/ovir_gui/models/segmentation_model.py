from collections.abc import Callable
from dataclasses import replace
from typing import TYPE_CHECKING, ClassVar

from dataclass_initializer import DataclassInitializer
from omegaconf import DictConfig, OmegaConf
from open_vocabulary_segmentation import (
    DetectionThresholds,
    DetectorSettings,
    Device,
    Precision,
    SegmentationThresholds,
    SegmenterBackend,
    SegmenterSettings,
)

from ..prompting import QueryKind
from ..recognition import RecognitionTask
from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision
from .detection_model import DetectionModel
from .licensed_dependency import LicensedDependency
from .model_preset import ModelPreset
from .model_selection import ModelSelection
from .profile_option import ProfileOption
from .recognition_model import RecognitionModel
from .segmentation_mode import SegmentationMode
from .threshold_controls import ThresholdControls

if TYPE_CHECKING:
    from .recognizer import Recognizer


class SegmentationModel(RecognitionModel):
    """
    Open-vocabulary instance segmenter of ``open_vocabulary_segmentation``.

    SAM and SAM 2 mask the boxes of an open-vocabulary detector, which decides the accepted query kinds; the detector of
    the preset can be replaced by any detection preset. SAM 3 and Florence-2 find the instances of phrases themselves,
    and SAM 3 also of reference images and of the exemplar boxes drawn on each picture. Masks and boxes are kept down to
    the confidence floor of ``DetectionModel``, so the minimum confidence is tuned afterwards through the class minimums
    without recognizing again. NMS thresholds are read at inference time.

    A box-prompted backend accepts the query kinds of its box detector, SAM 3 phrases, reference images and exemplar
    boxes, and the others phrases only.
    """

    TASK: ClassVar[RecognitionTask] = RecognitionTask.SEGMENTATION
    SECTION_KEY: ClassVar[str] = "segmenter"
    BOX_DETECTOR_KEY: ClassVar[str] = "box_detector"

    def __init__(self, preset: ModelPreset, settings: SegmenterSettings, box_detector_label: str | None) -> None:
        """
        Parameters
        ----------
        preset : ModelPreset
            Preset the settings were read from.
        settings : SegmenterSettings
            Library settings, possibly overridden.
        box_detector_label : str | None
            Detection preset whose detector replaced the one of the segmentation preset; ``None`` when unchanged.
        """
        super().__init__(preset)
        self._settings: SegmenterSettings = settings
        self._box_detector_label: str | None = box_detector_label

    @classmethod
    def from_preset(cls, preset: ModelPreset) -> "SegmentationModel":
        """
        Read a segmentation preset, including its nested box detector.

        Parameters
        ----------
        preset : ModelPreset
            YAML preset with a ``segmenter`` section.

        Returns
        -------
        SegmentationModel
            Model of the preset.

        Raises
        ------
        KeyError
            If the section is missing.
        TypeError
            If the ``thresholds`` entry is not a mapping.
        ValueError
            If the section does not describe valid settings of the preset's backend.
        """
        section: DictConfig = preset.read_section(cls.SECTION_KEY)
        box_section: object = section.get(cls.BOX_DETECTOR_KEY)
        flat_section: DictConfig = OmegaConf.masked_copy(
            section, [str(key) for key in section if key not in {cls.BOX_DETECTOR_KEY, "thresholds"}]
        )
        backend: SegmenterBackend = SegmenterBackend(str(flat_section["backend"]))
        thresholds_section: object = section.get("thresholds")
        if not isinstance(thresholds_section, DictConfig):
            raise TypeError(f"{preset.label}: 'thresholds' must be a mapping")
        box_detector: DetectorSettings | None = (
            DataclassInitializer.build(DetectorSettings, box_section) if isinstance(box_section, DictConfig) else None
        )
        settings: SegmenterSettings = SegmenterSettings(
            backend=backend,
            weights_path=str(flat_section["weights_path"]),
            thresholds=DataclassInitializer.build(SegmentationThresholds, thresholds_section),
            box_detector=box_detector,
            batch_size=int(flat_section.get("batch_size", 4)),
            device=Device(str(flat_section.get("device", Device.AUTO.value))),
            precision=Precision(str(flat_section.get("precision", Precision.FLOAT32.value))),
        )
        if backend.value != preset.backend:
            raise ValueError(f"{preset.label}: preset declares backend {backend.value}")
        return cls(preset, settings, None)

    @staticmethod
    def is_box_prompted_backend(backend: str) -> bool:
        """
        Whether a segmenter family masks the boxes of a detector.

        Parameters
        ----------
        backend : str
            Segmenter family.

        Returns
        -------
        bool
            True for SAM, SAM 2 and EdgeTAM finding instances of phrases; False for the other segmentation modes.
        """
        if SegmentationMode.of_backend(backend) is not SegmentationMode.CONCEPT:
            return False
        return SegmenterBackend(backend).is_box_prompted

    @property
    def settings(self) -> SegmenterSettings:
        """
        Library settings.

        Returns
        -------
        SegmenterSettings
            Settings with overrides applied.
        """
        return self._settings

    @property
    def is_box_prompted(self) -> bool:
        """
        Whether the model masks the boxes of a detector.

        Returns
        -------
        bool
            True for SAM and SAM 2.
        """
        return self._settings.box_detector is not None

    @property
    def box_detector_label(self) -> str | None:
        """
        Detection preset replacing the box detector of the preset.

        Returns
        -------
        str | None
            ``None`` when the preset's own detector is used.
        """
        return self._box_detector_label

    @property
    def box_detector_description(self) -> str:
        """
        Name of the detector finding the boxes.

        Returns
        -------
        str
            Detection preset, ``"<backend> <weights>"`` of the preset's own detector, or empty without one.
        """
        box_detector: DetectorSettings | None = self._settings.box_detector
        if box_detector is None:
            return ""
        if self._box_detector_label is not None:
            return self._box_detector_label
        return f"{box_detector.backend.value} {box_detector.weights_path}"

    @property
    def weights_path(self) -> str:
        return self._settings.weights_path

    @property
    def device(self) -> ComputeDevice:
        return ComputeDevice(self._settings.device.value)

    @property
    def precision(self) -> ComputePrecision:
        return ComputePrecision(self._settings.precision.value)

    @property
    def supported_precisions(self) -> tuple[ComputePrecision, ...]:
        return tuple(ComputePrecision(precision.value) for precision in Precision)

    @property
    def batch_size(self) -> int:
        return self._settings.batch_size

    @property
    def supported_query_kinds(self) -> frozenset[QueryKind]:
        box_detector: DetectorSettings | None = self._settings.box_detector
        if box_detector is not None:
            return DetectionModel.query_kinds_of(box_detector.backend)
        if self._settings.backend is SegmenterBackend.SAM3:
            return frozenset({QueryKind.TEXT, QueryKind.VISUAL, QueryKind.EXEMPLAR})
        return frozenset({QueryKind.TEXT})

    @property
    def licensed_dependencies(self) -> frozenset[LicensedDependency]:
        box_detector: DetectorSettings | None = self._settings.box_detector
        if box_detector is None:
            return frozenset()
        dependency: LicensedDependency | None = LicensedDependency.of_detector_backend(box_detector.backend)
        return frozenset() if dependency is None else frozenset({dependency})

    @property
    def options(self) -> tuple[ProfileOption, ...]:
        options: list[ProfileOption] = [
            ProfileOption("NMS", self.format_threshold(self._settings.thresholds.nms_iou_threshold)),
        ]
        box_detector: DetectorSettings | None = self._settings.box_detector
        if box_detector is not None:
            options.append(ProfileOption("Boxes", self.box_detector_description))
            options.append(ProfileOption("Box NMS", self.format_threshold(box_detector.thresholds.nms_iou_threshold)))
        return tuple(options)

    def loading_signature(self) -> tuple[str, ...]:
        signature: list[str] = [
            self.TASK.value,
            self._settings.backend.value,
            self._settings.weights_path,
            self._settings.device.value,
            self._settings.precision.value,
        ]
        box_detector: DetectorSettings | None = self._settings.box_detector
        if box_detector is not None:
            signature.extend(
                (
                    box_detector.backend.value,
                    box_detector.weights_path,
                    box_detector.device.value,
                    str(box_detector.is_half_precision_enabled),
                )
            )
        return tuple(signature)

    def as_selection(self) -> ModelSelection:
        return ModelSelection(
            task=self.TASK,
            backend=self.backend,
            preset_name=self.preset.name,
            device=self.device,
            precision=self.precision,
            nms_iou_threshold=self._settings.thresholds.nms_iou_threshold,
            box_detector_label=self._box_detector_label,
            batch_size=self._settings.batch_size,
        )

    @property
    def usage_description(self) -> str:
        if self.is_box_prompted:
            return f"Boxes from {self.box_detector_description}"
        if QueryKind.EXEMPLAR in self.supported_query_kinds:
            return (
                "Draw exemplar boxes on a picture to show (+) or exclude (−) a class there; "  # noqa: RUF001
                + "a class without phrases is segmented from its boxes alone."
            )
        return ""

    @property
    def threshold_controls(self) -> ThresholdControls:
        return ThresholdControls(confidence_label=None, is_nms_shown=True, is_minimum_confidence_shown=True)

    def fitted(self, selection: ModelSelection) -> ModelSelection:
        return replace(
            selection,
            confidence_threshold=None,
            box_detector_label=selection.box_detector_label if self.is_box_prompted else None,
        )

    def customized(
        self, selection: ModelSelection, box_detector_of: Callable[[str], DetectionModel]
    ) -> "SegmentationModel":
        """
        Same preset with the overrides of a selection, keeping masks and boxes down to the confidence floor.

        Parameters
        ----------
        selection : ModelSelection
            Device, precision, NMS threshold, batch size and box detector label to use.
        box_detector_of : Callable[[str], DetectionModel]
            Detection preset of the box detector label of the selection, replacing the preset's own box detector;
            ignored unless the model masks boxes.

        Returns
        -------
        SegmentationModel
            Model with the overrides applied; the box detector runs on the same device, precision and batch size.
        """
        box_model: DetectionModel | None = (
            None if selection.box_detector_label is None else box_detector_of(selection.box_detector_label)
        )
        device: Device = Device(selection.device.value)
        batch_size: int = self._settings.batch_size if selection.batch_size is None else selection.batch_size
        box_detector: DetectorSettings | None = self._settings.box_detector
        box_label: str | None = None
        if box_detector is not None:
            if box_model is not None:
                box_detector = box_model.settings
                box_label = box_model.preset.label
            box_detector = replace(
                box_detector,
                device=device,
                is_half_precision_enabled=selection.precision is ComputePrecision.FLOAT16,
                thresholds=DetectionThresholds(
                    confidence_threshold=min(
                        box_detector.thresholds.confidence_threshold, DetectionModel.CONFIDENCE_FLOOR
                    ),
                    nms_iou_threshold=box_detector.thresholds.nms_iou_threshold,
                ),
                batch_size=batch_size,
            )
        settings: SegmenterSettings = replace(
            self._settings,
            device=device,
            precision=Precision(selection.precision.value),
            thresholds=SegmentationThresholds(
                confidence_threshold=min(
                    self._settings.thresholds.confidence_threshold, DetectionModel.CONFIDENCE_FLOOR
                ),
                nms_iou_threshold=selection.nms_iou_threshold,
            ),
            box_detector=box_detector,
            batch_size=batch_size,
        )
        return SegmentationModel(self.preset, settings, box_label)

    def build_recognizer(self) -> "Recognizer[SegmentationModel]":
        from .segmenter_recognizer import SegmenterRecognizer

        return SegmenterRecognizer(self)
