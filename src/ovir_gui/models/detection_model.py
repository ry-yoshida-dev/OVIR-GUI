from dataclasses import replace
from typing import TYPE_CHECKING, ClassVar

from dataclass_initializer import DataclassInitializer
from omegaconf import DictConfig
from open_vocabulary_detector import DetectionThresholds, DetectorBackend, DetectorSettings, Device

from ..prompting import QueryKind
from ..recognition import RecognitionTask
from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision
from .licensed_dependency import LicensedDependency
from .model_preset import ModelPreset
from .model_selection import ModelSelection
from .profile_option import ProfileOption
from .recognition_model import RecognitionModel

if TYPE_CHECKING:
    from .recognizer import Recognizer


class DetectionModel(RecognitionModel):
    """
    Open-vocabulary object detector of ``open_vocabulary_detector``.

    Detections are kept down to a low confidence floor, so the minimum confidence is tuned afterwards through the
    class minimums without recognizing again. The NMS threshold is read at inference time, so changing it reuses the
    loaded model.
    """

    TASK: ClassVar[RecognitionTask] = RecognitionTask.DETECTION
    SECTION_KEY: ClassVar[str] = "detector"
    CONFIDENCE_FLOOR: ClassVar[float] = 0.05

    def __init__(self, preset: ModelPreset, settings: DetectorSettings) -> None:
        """
        Parameters
        ----------
        preset : ModelPreset
            Preset the settings were read from.
        settings : DetectorSettings
            Library settings, possibly overridden.
        """
        super().__init__(preset)
        self._settings: DetectorSettings = settings

    @classmethod
    def from_preset(cls, preset: ModelPreset) -> "DetectionModel":
        """
        Read a detection preset.

        Parameters
        ----------
        preset : ModelPreset
            YAML preset with a ``detector`` section.

        Returns
        -------
        DetectionModel
            Model of the preset.

        Raises
        ------
        KeyError
            If the section is missing.
        ValueError
            If the section does not describe valid settings of the preset's backend.
        """
        section: DictConfig = preset.read_section(cls.SECTION_KEY)
        settings: DetectorSettings = DataclassInitializer.build(DetectorSettings, section)
        if settings.backend.value != preset.backend:
            raise ValueError(f"{preset.label}: preset declares backend {settings.backend.value}")
        return cls(preset, settings)

    @staticmethod
    def query_kinds_of(backend: DetectorBackend) -> frozenset[QueryKind]:
        """
        Query kinds a detector family accepts.

        Parameters
        ----------
        backend : DetectorBackend
            Detector family.

        Returns
        -------
        frozenset[QueryKind]
            Accepted kinds.
        """
        return frozenset(QueryKind(kind.value) for kind in backend.supported_prompt_kinds)

    @property
    def settings(self) -> DetectorSettings:
        """
        Library settings.

        Returns
        -------
        DetectorSettings
            Settings with overrides applied.
        """
        return self._settings

    @property
    def weights_path(self) -> str:
        return self._settings.weights_path

    @property
    def device(self) -> ComputeDevice:
        return ComputeDevice(self._settings.device.value)

    @property
    def precision(self) -> ComputePrecision:
        return ComputePrecision.FLOAT16 if self._settings.is_half_precision_enabled else ComputePrecision.FLOAT32

    @property
    def supported_precisions(self) -> tuple[ComputePrecision, ...]:
        return (ComputePrecision.FLOAT32, ComputePrecision.FLOAT16)

    @property
    def batch_size(self) -> int:
        return self._settings.batch_size

    @property
    def supported_query_kinds(self) -> frozenset[QueryKind]:
        return self.query_kinds_of(self._settings.backend)

    @property
    def licensed_dependencies(self) -> frozenset[LicensedDependency]:
        dependency: LicensedDependency | None = LicensedDependency.of_detector_backend(self._settings.backend)
        return frozenset() if dependency is None else frozenset({dependency})

    @property
    def options(self) -> tuple[ProfileOption, ...]:
        return (ProfileOption("NMS", self.format_threshold(self._settings.thresholds.nms_iou_threshold)),)

    def loading_signature(self) -> tuple[str, ...]:
        return (
            self.TASK.value,
            self._settings.backend.value,
            self._settings.weights_path,
            self._settings.device.value,
            str(self._settings.is_half_precision_enabled),
        )

    def as_selection(self) -> ModelSelection:
        return ModelSelection(
            task=self.TASK,
            backend=self.backend,
            preset_name=self.preset.name,
            device=self.device,
            precision=self.precision,
            nms_iou_threshold=self._settings.thresholds.nms_iou_threshold,
            batch_size=self._settings.batch_size,
        )

    def customized(self, selection: ModelSelection) -> "DetectionModel":
        """
        Same preset with the overrides of a selection, keeping detections down to the confidence floor.

        Parameters
        ----------
        selection : ModelSelection
            Device, precision, NMS threshold and batch size to use.

        Returns
        -------
        DetectionModel
            Model with the overrides applied.
        """
        thresholds: DetectionThresholds = DetectionThresholds(
            confidence_threshold=min(self._settings.thresholds.confidence_threshold, self.CONFIDENCE_FLOOR),
            nms_iou_threshold=selection.nms_iou_threshold,
        )
        return DetectionModel(
            self.preset,
            replace(
                self._settings,
                device=Device(selection.device.value),
                is_half_precision_enabled=selection.precision is ComputePrecision.FLOAT16,
                thresholds=thresholds,
                batch_size=self._settings.batch_size if selection.batch_size is None else selection.batch_size,
            ),
        )

    def build_recognizer(self) -> "Recognizer":
        from .detector_recognizer import DetectorRecognizer

        return DetectorRecognizer(self)
