from dataclasses import replace
from typing import TYPE_CHECKING, ClassVar

from dataclass_initializer import DataclassInitializer
from omegaconf import DictConfig
from open_vocabulary_segmentation import (
    Device,
    MaskGenerationOptions,
    MaskGeneratorSettings,
    Precision,
    PromptableSegmenterSettings,
)

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


class MaskGenerationModel(RecognitionModel):
    """
    Automatic mask generator of ``open_vocabulary_segmentation``, segmenting every region of a picture.

    A grid of point prompts covers the picture; masks are kept by predicted IoU and deduplicated by box NMS. Every
    region is reported under ``REGION_CLASS_NAME``. Both thresholds are read at inference time.
    """

    TASK: ClassVar[RecognitionTask] = RecognitionTask.SEGMENTATION
    MODE: ClassVar[SegmentationMode] = SegmentationMode.GENERATION
    REGION_CLASS_NAME: ClassVar[str] = "region"
    QUERY_LABEL: ClassVar[str] = "automatic"
    DISABLED_NMS_THRESHOLD: ClassVar[float] = 1.0

    def __init__(self, preset: ModelPreset, settings: MaskGeneratorSettings) -> None:
        """
        Parameters
        ----------
        preset : ModelPreset
            Preset the settings were read from.
        settings : MaskGeneratorSettings
            Library settings, possibly overridden.
        """
        super().__init__(preset)
        self._settings: MaskGeneratorSettings = settings

    @classmethod
    def from_preset(cls, preset: ModelPreset) -> "MaskGenerationModel":
        """
        Read a mask generation preset.

        Parameters
        ----------
        preset : ModelPreset
            YAML preset with a ``mask_generator`` section.

        Returns
        -------
        MaskGenerationModel
            Model of the preset.

        Raises
        ------
        KeyError
            If the section is missing.
        ValueError
            If the section does not describe valid settings of the preset's backend.
        """
        section: DictConfig = preset.read_section(cls.MODE.section_key)
        settings: MaskGeneratorSettings = DataclassInitializer.build(MaskGeneratorSettings, section)
        if f"{cls.MODE.backend_prefix}{settings.segmenter.backend.value}" != preset.backend:
            raise ValueError(f"{preset.label}: preset declares backend {settings.segmenter.backend.value}")
        return cls(preset, settings)

    @property
    def settings(self) -> MaskGeneratorSettings:
        """
        Library settings.

        Returns
        -------
        MaskGeneratorSettings
            Settings with overrides applied.
        """
        return self._settings

    @property
    def weights_path(self) -> str:
        return self._settings.segmenter.weights_path

    @property
    def device(self) -> ComputeDevice:
        return ComputeDevice(self._settings.segmenter.device.value)

    @property
    def precision(self) -> ComputePrecision:
        return ComputePrecision(self._settings.segmenter.precision.value)

    @property
    def supported_precisions(self) -> tuple[ComputePrecision, ...]:
        return tuple(ComputePrecision(precision.value) for precision in Precision)

    @property
    def batch_size(self) -> int:
        return self._settings.segmenter.batch_size

    @property
    def supported_query_kinds(self) -> frozenset[QueryKind]:
        return frozenset()

    @property
    def prompt_mode(self) -> PromptMode:
        return PromptMode.AUTOMATIC

    @property
    def options(self) -> tuple[ProfileOption, ...]:
        options: MaskGenerationOptions = self._settings.options
        return (
            ProfileOption("Min IoU", self.format_threshold(options.predicted_iou_threshold)),
            ProfileOption("NMS", self.format_threshold(self._nms_threshold)),
            ProfileOption("Points", f"{options.points_per_side}²"),
        )

    def loading_signature(self) -> tuple[str, ...]:
        segmenter: PromptableSegmenterSettings = self._settings.segmenter
        return (
            self.TASK.value,
            self.MODE.value,
            segmenter.backend.value,
            segmenter.weights_path,
            segmenter.device.value,
            segmenter.precision.value,
        )

    def as_selection(self) -> ModelSelection:
        return ModelSelection(
            task=self.TASK,
            backend=self.backend,
            preset_name=self.preset.name,
            device=self.device,
            precision=self.precision,
            confidence_threshold=self._settings.options.predicted_iou_threshold,
            nms_iou_threshold=self._nms_threshold,
            batch_size=self._settings.segmenter.batch_size,
        )

    def customized(self, selection: ModelSelection) -> "MaskGenerationModel":
        """
        Same preset with the overrides of a selection.

        Parameters
        ----------
        selection : ModelSelection
            Device, precision, minimum predicted IoU, box NMS threshold and batch size to use; NMS off keeps
            overlapping masks.

        Returns
        -------
        MaskGenerationModel
            Model with the overrides applied.
        """
        options: MaskGenerationOptions = replace(
            self._settings.options,
            predicted_iou_threshold=(
                self._settings.options.predicted_iou_threshold
                if selection.confidence_threshold is None
                else selection.confidence_threshold
            ),
            box_nms_threshold=(
                self.DISABLED_NMS_THRESHOLD if selection.nms_iou_threshold is None else selection.nms_iou_threshold
            ),
        )
        segmenter: PromptableSegmenterSettings = replace(
            self._settings.segmenter,
            device=Device(selection.device.value),
            precision=Precision(selection.precision.value),
            batch_size=(self._settings.segmenter.batch_size if selection.batch_size is None else selection.batch_size),
        )
        return MaskGenerationModel(self.preset, replace(self._settings, segmenter=segmenter, options=options))

    def build_recognizer(self) -> "Recognizer":
        from .mask_generation_recognizer import MaskGenerationRecognizer

        return MaskGenerationRecognizer(self)

    @property
    def _nms_threshold(self) -> float | None:
        threshold: float = self._settings.options.box_nms_threshold
        return None if threshold >= self.DISABLED_NMS_THRESHOLD else threshold
