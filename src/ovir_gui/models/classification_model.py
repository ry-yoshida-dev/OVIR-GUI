from dataclasses import replace
from typing import TYPE_CHECKING, ClassVar

from omegaconf import DictConfig, ListConfig, OmegaConf
from open_vocabulary_classification import (
    ClassifierBackend,
    ClassifierSettings,
    Device,
    ImagePooling,
    ImageTiling,
    Precision,
)

from ..prompting import QueryKind
from ..recognition import RecognitionTask
from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision
from .model_preset import ModelPreset
from .model_selection import ModelSelection
from .profile_option import ProfileOption
from .recognition_model import RecognitionModel

if TYPE_CHECKING:
    from .recognizer import Recognizer


class ClassificationModel(RecognitionModel):
    """
    Open-vocabulary image classifier of ``open_vocabulary_classification`` (CLIP, SigLIP and their variants).

    Classifiers take phrases and reference images; the image pooling can be chosen among those the backend offers,
    and large pictures can be classified on a grid of overlapping tiles so that small objects count.
    """

    TASK: ClassVar[RecognitionTask] = RecognitionTask.CLASSIFICATION
    SECTION_KEY: ClassVar[str] = "classifier"

    def __init__(self, preset: ModelPreset, settings: ClassifierSettings, tiling: ImageTiling | None = None) -> None:
        """
        Parameters
        ----------
        preset : ModelPreset
            Preset the settings were read from.
        settings : ClassifierSettings
            Library settings, possibly overridden.
        tiling : ImageTiling | None, optional
            Grid of tiles each picture is classified on besides the whole picture; ``None`` classifies the whole
            picture only.
        """
        super().__init__(preset)
        self._settings: ClassifierSettings = settings
        self._tiling: ImageTiling | None = tiling

    @classmethod
    def from_preset(cls, preset: ModelPreset) -> "ClassificationModel":
        """
        Read a classification preset.

        Parameters
        ----------
        preset : ModelPreset
            YAML preset with a ``classifier`` section.

        Returns
        -------
        ClassificationModel
            Model of the preset.

        Raises
        ------
        KeyError
            If the section is missing.
        ValueError
            If the section does not describe valid settings of the preset's backend.
        """
        section: DictConfig = preset.read_section(cls.SECTION_KEY)
        values: dict[str, object] = {
            str(key): OmegaConf.to_container(value, resolve=True)
            if isinstance(value, DictConfig | ListConfig)
            else value
            for key, value in section.items_ex(resolve=True)
        }
        settings: ClassifierSettings = ClassifierSettings.from_mapping(values)
        if settings.backend.value != preset.backend:
            raise ValueError(f"{preset.label}: preset declares backend {settings.backend.value}")
        return cls(preset, settings)

    @staticmethod
    def image_poolings_of(backend: str) -> tuple[str, ...]:
        """
        Image poolings a classifier family offers.

        Parameters
        ----------
        backend : str
            Classifier family.

        Returns
        -------
        tuple[str, ...]
            Pooling values, sorted.
        """
        return tuple(sorted(pooling.value for pooling in ClassifierBackend(backend).supported_image_poolings))

    @property
    def settings(self) -> ClassifierSettings:
        """
        Library settings.

        Returns
        -------
        ClassifierSettings
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
        return self._settings.batch_size

    @property
    def supported_query_kinds(self) -> frozenset[QueryKind]:
        return frozenset({QueryKind.TEXT, QueryKind.VISUAL})

    @property
    def options(self) -> tuple[ProfileOption, ...]:
        return (
            ProfileOption("Pooling", self._settings.image_pooling.value),
            ProfileOption("Templates", str(len(self._settings.text_templates))),
            ProfileOption(
                "Tiling", "off" if self._tiling is None else f"{self._tiling.grid_size}x{self._tiling.grid_size}"
            ),
        )

    @property
    def tiling(self) -> ImageTiling | None:
        """
        Grid of tiles each picture is classified on.

        Returns
        -------
        ImageTiling | None
            ``None`` when only the whole picture is classified.
        """
        return self._tiling

    @property
    def text_templates(self) -> tuple[str, ...]:
        """
        Templates every phrase is filled into.

        Returns
        -------
        tuple[str, ...]
            Templates of the preset.
        """
        return self._settings.text_templates

    def loading_signature(self) -> tuple[str, ...]:
        return (
            self.TASK.value,
            self._settings.backend.value,
            self._settings.weights_path,
            self._settings.image_pooling.value,
            "|".join(self._settings.text_templates),
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
            image_pooling=self._settings.image_pooling.value,
            tiling_grid_size=None if self._tiling is None else self._tiling.grid_size,
        )

    def customized(self, selection: ModelSelection) -> "ClassificationModel":
        """
        Same preset with the overrides of a selection.

        Parameters
        ----------
        selection : ModelSelection
            Device, precision, pooling and tiling to use.

        Returns
        -------
        ClassificationModel
            Model with the overrides applied.

        Raises
        ------
        ValueError
            If the pooling is not offered by the backend.
        """
        pooling: ImagePooling = (
            self._settings.image_pooling if selection.image_pooling is None else ImagePooling(selection.image_pooling)
        )
        return ClassificationModel(
            self.preset,
            replace(
                self._settings,
                device=Device(selection.device.value),
                precision=Precision(selection.precision.value),
                image_pooling=pooling,
            ),
            None if selection.tiling_grid_size is None else ImageTiling(grid_size=selection.tiling_grid_size),
        )

    def build_recognizer(self) -> "Recognizer":
        from .classifier_recognizer import ClassifierRecognizer

        return ClassifierRecognizer(self)
