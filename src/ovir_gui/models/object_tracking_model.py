from dataclasses import replace
from typing import TYPE_CHECKING, ClassVar

from dataclass_initializer import DataclassInitializer
from omegaconf import DictConfig
from open_vocabulary_segmentation import Device, ObjectTrackerSettings, Precision, PromptElement

from ..prompting import PromptMode, QueryKind
from ..recognition import RecognitionTask
from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision
from .model_preset import ModelPreset
from .model_selection import ModelSelection
from .profile_option import ProfileOption
from .recognition_model import RecognitionModel
from .segmentation_mode import SegmentationMode

if TYPE_CHECKING:
    from .recognizer import Recognizer


class ObjectTrackingModel(RecognitionModel):
    """
    Video object tracker of ``open_vocabulary_segmentation`` (SAM 2, SAM 3 tracker, EdgeTAM).

    Objects marked on some frames of a video are segmented on every following frame, read in order with a memory of
    the past; a mark on a later frame corrects its object from there on. An image is a video of one frame. Objects
    whose presence score is below the minimum are left out of a frame; the minimum is read at inference time.

    Attributes
    ----------
    minimum_presence : float
        Lowest presence score of an object shown on a frame, in ``[0, 1]``.
    """

    TASK: ClassVar[RecognitionTask] = RecognitionTask.SEGMENTATION
    MODE: ClassVar[SegmentationMode] = SegmentationMode.OBJECT_TRACKING
    DEFAULT_MINIMUM_PRESENCE: ClassVar[float] = 0.5
    SUPPORTED_ELEMENTS: ClassVar[frozenset[PromptElement]] = frozenset({PromptElement.POINT, PromptElement.BOX})

    def __init__(self, preset: ModelPreset, settings: ObjectTrackerSettings, minimum_presence: float) -> None:
        """
        Parameters
        ----------
        preset : ModelPreset
            Preset the settings were read from.
        settings : ObjectTrackerSettings
            Library settings, possibly overridden.
        minimum_presence : float
            Lowest presence score of a shown object.

        Raises
        ------
        ValueError
            If the minimum presence is outside ``[0, 1]``.
        """
        super().__init__(preset)
        if not 0.0 <= minimum_presence <= 1.0:
            raise ValueError(f"minimum_presence must be in [0, 1]. got {minimum_presence}")
        self._settings: ObjectTrackerSettings = settings
        self.minimum_presence: float = minimum_presence

    @classmethod
    def from_preset(cls, preset: ModelPreset) -> "ObjectTrackingModel":
        """
        Read an object tracking preset.

        Parameters
        ----------
        preset : ModelPreset
            YAML preset with an ``object_tracker`` section.

        Returns
        -------
        ObjectTrackingModel
            Model of the preset.

        Raises
        ------
        KeyError
            If the section is missing.
        ValueError
            If the section does not describe valid settings of the preset's backend.
        """
        section: DictConfig = preset.read_section(cls.MODE.section_key)
        settings: ObjectTrackerSettings = DataclassInitializer.build(ObjectTrackerSettings, section)
        if f"{cls.MODE.backend_prefix}{settings.backend.value}" != preset.backend:
            raise ValueError(f"{preset.label}: preset declares backend {settings.backend.value}")
        return cls(preset, settings, cls.DEFAULT_MINIMUM_PRESENCE)

    @property
    def settings(self) -> ObjectTrackerSettings:
        """
        Library settings.

        Returns
        -------
        ObjectTrackerSettings
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
        return ComputePrecision(self._settings.precision.value)

    @property
    def supported_precisions(self) -> tuple[ComputePrecision, ...]:
        return tuple(ComputePrecision(precision.value) for precision in Precision)

    @property
    def batch_size(self) -> int:
        return 1

    @property
    def supported_query_kinds(self) -> frozenset[QueryKind]:
        return frozenset({QueryKind.MARK})

    @property
    def prompt_mode(self) -> PromptMode:
        return PromptMode.MARKS

    @property
    def is_sequential(self) -> bool:
        return True

    @property
    def options(self) -> tuple[ProfileOption, ...]:
        return (ProfileOption("Min presence", self.format_threshold(self.minimum_presence)),)

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
            confidence_threshold=self.minimum_presence,
        )

    def customized(self, selection: ModelSelection) -> "ObjectTrackingModel":
        """
        Same preset with the overrides of a selection.

        Parameters
        ----------
        selection : ModelSelection
            Device, precision and minimum presence to use.

        Returns
        -------
        ObjectTrackingModel
            Model with the overrides applied.
        """
        settings: ObjectTrackerSettings = replace(
            self._settings, device=Device(selection.device.value), precision=Precision(selection.precision.value)
        )
        minimum_presence: float = (
            self.minimum_presence if selection.confidence_threshold is None else selection.confidence_threshold
        )
        return ObjectTrackingModel(self.preset, settings, minimum_presence)

    def build_recognizer(self) -> "Recognizer":
        from .object_tracking_recognizer import ObjectTrackingRecognizer

        return ObjectTrackingRecognizer(self)
