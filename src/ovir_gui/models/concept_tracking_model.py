from dataclasses import replace
from typing import TYPE_CHECKING, ClassVar

from dataclass_initializer import DataclassInitializer
from omegaconf import DictConfig
from open_vocabulary_segmentation import ConceptTrackerSettings, Device, Precision

from ..prompting import QueryKind
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


class ConceptTrackingModel(RecognitionModel):
    """
    SAM 3 video concept tracker of ``open_vocabulary_segmentation``.

    Every instance of the phrases and reference images of the classes is detected on each frame of a video, read in
    order, and matched with the tracks of earlier frames; results name the track of each instance. An image is a video
    of one frame.
    """

    TASK: ClassVar[RecognitionTask] = RecognitionTask.SEGMENTATION
    MODE: ClassVar[SegmentationMode] = SegmentationMode.CONCEPT_TRACKING
    FAMILY_NAME: ClassVar[str] = "sam3"

    def __init__(self, preset: ModelPreset, settings: ConceptTrackerSettings) -> None:
        """
        Parameters
        ----------
        preset : ModelPreset
            Preset the settings were read from.
        settings : ConceptTrackerSettings
            Library settings, possibly overridden.
        """
        super().__init__(preset)
        self._settings: ConceptTrackerSettings = settings

    @classmethod
    def from_preset(cls, preset: ModelPreset) -> "ConceptTrackingModel":
        """
        Read a concept tracking preset.

        Parameters
        ----------
        preset : ModelPreset
            YAML preset with a ``concept_tracker`` section.

        Returns
        -------
        ConceptTrackingModel
            Model of the preset.

        Raises
        ------
        KeyError
            If the section is missing.
        ValueError
            If the section does not describe valid settings, or the preset is not of SAM 3.
        """
        section: DictConfig = preset.read_section(cls.MODE.section_key)
        settings: ConceptTrackerSettings = DataclassInitializer.build(ConceptTrackerSettings, section)
        if f"{cls.MODE.backend_prefix}{cls.FAMILY_NAME}" != preset.backend:
            raise ValueError(f"{preset.label}: concept tracking runs SAM 3 only")
        return cls(preset, settings)

    @property
    def settings(self) -> ConceptTrackerSettings:
        """
        Library settings.

        Returns
        -------
        ConceptTrackerSettings
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
        return frozenset({QueryKind.TEXT, QueryKind.VISUAL})

    @property
    def is_sequential(self) -> bool:
        return True

    @property
    def options(self) -> tuple[ProfileOption, ...]:
        return (
            ProfileOption("Conf", self.format_threshold(self._settings.confidence_threshold)),
            ProfileOption("Track score", self.format_threshold(self._settings.tracker_score_threshold)),
        )

    def loading_signature(self) -> tuple[str, ...]:
        return (
            self.TASK.value,
            self.MODE.value,
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
            confidence_threshold=self._settings.confidence_threshold,
        )

    def customized(self, selection: ModelSelection) -> "ConceptTrackingModel":
        """
        Same preset with the overrides of a selection.

        Parameters
        ----------
        selection : ModelSelection
            Device, precision and detection confidence threshold to use.

        Returns
        -------
        ConceptTrackingModel
            Model with the overrides applied.
        """
        settings: ConceptTrackerSettings = replace(
            self._settings,
            device=Device(selection.device.value),
            precision=Precision(selection.precision.value),
            confidence_threshold=(
                self._settings.confidence_threshold
                if selection.confidence_threshold is None
                else selection.confidence_threshold
            ),
        )
        return ConceptTrackingModel(self.preset, settings)

    def build_recognizer(self) -> "Recognizer":
        from .concept_tracking_recognizer import ConceptTrackingRecognizer

        return ConceptTrackingRecognizer(self)
