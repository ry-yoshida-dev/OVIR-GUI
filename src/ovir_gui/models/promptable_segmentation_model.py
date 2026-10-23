from collections.abc import Callable
from dataclasses import replace
from typing import TYPE_CHECKING, ClassVar

from dataclass_initializer import DataclassInitializer
from omegaconf import DictConfig
from open_vocabulary_segmentation import Device, Precision, PromptableSegmenterSettings, PromptElement

from ..prompting import PromptMode, QueryKind
from ..recognition import RecognitionTask
from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision
from .model_preset import ModelPreset
from .model_selection import ModelSelection
from .profile_option import ProfileOption
from .recognition_model import RecognitionModel
from .segmentation_mode import SegmentationMode
from .threshold_controls import ThresholdControls

if TYPE_CHECKING:
    from .detection_model import DetectionModel
    from .recognizer import Recognizer


class PromptableSegmentationModel(RecognitionModel):
    """
    Promptable segmenter of ``open_vocabulary_segmentation`` (SAM, SAM 2, SAM 3 tracker, EdgeTAM, Florence-2).

    Each object marked on a picture by points and a box is segmented on that picture and reported under the class of
    its mark with its predicted IoU as confidence. Every mask is kept, so the minimum is tuned afterwards through the
    class minimums without recognizing again.
    """

    TASK: ClassVar[RecognitionTask] = RecognitionTask.SEGMENTATION
    MODE: ClassVar[SegmentationMode] = SegmentationMode.PROMPTABLE

    def __init__(self, preset: ModelPreset, settings: PromptableSegmenterSettings) -> None:
        """
        Parameters
        ----------
        preset : ModelPreset
            Preset the settings were read from.
        settings : PromptableSegmenterSettings
            Library settings, possibly overridden.
        """
        super().__init__(preset)
        self._settings: PromptableSegmenterSettings = settings

    @classmethod
    def from_preset(cls, preset: ModelPreset) -> "PromptableSegmentationModel":
        """
        Read a promptable segmentation preset.

        Parameters
        ----------
        preset : ModelPreset
            YAML preset with a ``promptable_segmenter`` section.

        Returns
        -------
        PromptableSegmentationModel
            Model of the preset.

        Raises
        ------
        KeyError
            If the section is missing.
        ValueError
            If the section does not describe valid settings of the preset's backend.
        """
        section: DictConfig = preset.read_section(cls.MODE.section_key)
        settings: PromptableSegmenterSettings = DataclassInitializer.build(PromptableSegmenterSettings, section)
        if f"{cls.MODE.backend_prefix}{settings.backend.value}" != preset.backend:
            raise ValueError(f"{preset.label}: preset declares backend {settings.backend.value}")
        return cls(preset, settings)

    @property
    def settings(self) -> PromptableSegmenterSettings:
        """
        Library settings.

        Returns
        -------
        PromptableSegmenterSettings
            Settings with overrides applied.
        """
        return self._settings

    @property
    def supported_elements(self) -> frozenset[PromptElement]:
        """
        Parts of a mark the model reads.

        Returns
        -------
        frozenset[PromptElement]
            Points, boxes and masks for the SAM families, boxes for Florence-2.
        """
        return self._settings.backend.supported_prompt_elements

    @property
    def is_point_supported(self) -> bool:
        """
        Whether clicked points reach the model, rather than boxes only.

        Returns
        -------
        bool
            False for Florence-2.
        """
        return PromptElement.POINT in self.supported_elements

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
        return frozenset({QueryKind.MARK})

    @property
    def prompt_mode(self) -> PromptMode:
        return PromptMode.MARKS

    @property
    def options(self) -> tuple[ProfileOption, ...]:
        return ()

    def loading_signature(self) -> tuple[str, ...]:
        return (
            self.TASK.value,
            self.MODE.value,
            self._settings.backend.value,
            self._settings.weights_path,
            self._settings.device.value,
            self._settings.precision.value,
        )

    def as_selection(self) -> ModelSelection:
        return ModelSelection(
            task=self.TASK,
            backend=self.backend,
            preset_name=self.preset.name,
            device=self.device,
            precision=self.precision,
            batch_size=self._settings.batch_size,
        )

    @property
    def usage_description(self) -> str:
        if self.is_point_supported:
            return "Click on an object (right-click excludes a spot) or drag a box around it."
        return "Drag a box around each object; this model takes boxes only."

    @property
    def threshold_controls(self) -> ThresholdControls:
        return ThresholdControls(confidence_label=None, is_nms_shown=False, is_minimum_confidence_shown=True)

    def fitted(self, selection: ModelSelection) -> ModelSelection:
        return replace(selection, confidence_threshold=None, nms_iou_threshold=None, box_detector_label=None)

    def customized(
        self, selection: ModelSelection, box_detector_of: Callable[[str], "DetectionModel"]
    ) -> "PromptableSegmentationModel":
        """
        Same preset with the overrides of a selection.

        Parameters
        ----------
        selection : ModelSelection
            Device, precision and batch size to use.
        box_detector_of : Callable[[str], DetectionModel]
            Not read; the model has no box detector.

        Returns
        -------
        PromptableSegmentationModel
            Model with the overrides applied.
        """
        settings: PromptableSegmenterSettings = replace(
            self._settings,
            device=Device(selection.device.value),
            precision=Precision(selection.precision.value),
            batch_size=self._settings.batch_size if selection.batch_size is None else selection.batch_size,
        )
        return PromptableSegmentationModel(self.preset, settings)

    def build_recognizer(self) -> "Recognizer[PromptableSegmentationModel]":
        from .promptable_recognizer import PromptableRecognizer

        return PromptableRecognizer(self)
