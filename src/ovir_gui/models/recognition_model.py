from abc import ABC, abstractmethod
from collections.abc import Callable
from typing import TYPE_CHECKING, ClassVar

from open_vocabulary_classification import PromptAggregation, ScoreActivation

from ..prompting import PromptMode, QueryKind
from ..recognition import RecognitionTask
from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision
from .licensed_dependency import LicensedDependency
from .model_preset import ModelPreset
from .model_profile import ModelProfile
from .model_selection import ModelSelection
from .profile_option import ProfileOption
from .threshold_controls import ThresholdControls

if TYPE_CHECKING:
    from .detection_model import DetectionModel
    from .recognizer import Recognizer


class RecognitionModel(ABC):
    """
    Settings of one model of a model library, seen the same way for every task.

    Each subclass wraps the settings type of its library and is the only place that knows it, together with the
    matching ``Recognizer``. Instances are immutable; overrides produce a new model.
    """

    TASK: ClassVar[RecognitionTask]

    def __init__(self, preset: ModelPreset) -> None:
        """
        Parameters
        ----------
        preset : ModelPreset
            Preset the settings were read from.

        Raises
        ------
        ValueError
            If the preset belongs to another task.
        """
        if preset.task is not self.TASK:
            raise ValueError(f"{type(self).__name__} needs a {self.TASK.value} preset. got {preset.label}")
        self._preset: ModelPreset = preset

    @property
    def preset(self) -> ModelPreset:
        """
        Preset the settings were read from.

        Returns
        -------
        ModelPreset
            Preset given at construction.
        """
        return self._preset

    @property
    def task(self) -> RecognitionTask:
        """
        Task of the model.

        Returns
        -------
        RecognitionTask
            ``TASK`` of the class.
        """
        return self.TASK

    @property
    def backend(self) -> str:
        """
        Model family.

        Returns
        -------
        str
            Backend of the preset.
        """
        return self._preset.backend

    @property
    @abstractmethod
    def weights_path(self) -> str:
        """
        Checkpoint the model loads.

        Returns
        -------
        str
            Hub id or local path.
        """

    @property
    @abstractmethod
    def device(self) -> ComputeDevice:
        """
        Device the model runs on.

        Returns
        -------
        ComputeDevice
            Requested device.
        """

    @property
    @abstractmethod
    def precision(self) -> ComputePrecision:
        """
        Floating-point type the model runs in.

        Returns
        -------
        ComputePrecision
            Requested precision.
        """

    @property
    @abstractmethod
    def supported_precisions(self) -> tuple[ComputePrecision, ...]:
        """
        Precisions the model library offers.

        Returns
        -------
        tuple[ComputePrecision, ...]
            Precisions in display order.
        """

    @property
    @abstractmethod
    def batch_size(self) -> int:
        """
        Images per forward pass.

        Returns
        -------
        int
            Mini-batch size.
        """

    @property
    @abstractmethod
    def supported_query_kinds(self) -> frozenset[QueryKind]:
        """
        Query kinds the model accepts.

        Returns
        -------
        frozenset[QueryKind]
            E.g. ``TEXT`` and ``VISUAL``; ``MARK`` for models segmenting marked objects, empty for automatic mask
            generation.
        """

    @property
    def prompt_mode(self) -> PromptMode:
        """
        How the model is told what to recognize.

        Returns
        -------
        PromptMode
            ``CLASSES`` unless a subclass segments marked objects or every region.
        """
        return PromptMode.CLASSES

    @property
    def is_sequential(self) -> bool:
        """
        Whether the model follows objects through a video, reading its frames in order with a memory of the past.

        Returns
        -------
        bool
            False unless a subclass tracks.
        """
        return False

    @property
    def licensed_dependencies(self) -> frozenset[LicensedDependency]:
        """
        Optional modules of restrictive licenses the model is imported from.

        Returns
        -------
        frozenset[LicensedDependency]
            Empty unless a subclass runs a model of such a module.
        """
        return frozenset()

    @property
    def is_point_supported(self) -> bool:
        """
        Whether clicked points of a mark reach the model, rather than boxes only.

        Returns
        -------
        bool
            True unless a subclass takes boxes only.
        """
        return True

    @property
    def text_templates(self) -> tuple[str, ...] | None:
        """
        Templates every phrase is filled into.

        Returns
        -------
        tuple[str, ...] | None
            ``None`` unless a subclass fills phrases into templates.
        """
        return None

    @property
    def aggregation(self) -> PromptAggregation | None:
        """
        How the prompts and templates of every class become its score.

        Returns
        -------
        PromptAggregation | None
            ``None`` unless a subclass aggregates prompts and templates.
        """
        return None

    @property
    def score_activation(self) -> ScoreActivation | None:
        """
        Activation turning the logits of the model into scores.

        Returns
        -------
        ScoreActivation | None
            ``None`` unless a subclass scores classes from logits.
        """
        return None

    @property
    def usage_description(self) -> str:
        """
        How the user tells the model what to recognize, shown next to the model settings.

        Returns
        -------
        str
            Empty unless a subclass needs explaining.
        """
        return ""

    @property
    def threshold_controls(self) -> ThresholdControls:
        """
        Threshold settings the model reads, shown with the model settings.

        Returns
        -------
        ThresholdControls
            No threshold unless a subclass reads some.
        """
        return ThresholdControls(confidence_label=None, is_nms_shown=False, is_minimum_confidence_shown=False)

    @property
    @abstractmethod
    def options(self) -> tuple[ProfileOption, ...]:
        """
        Settings telling results of this model apart, besides device and precision.

        Returns
        -------
        tuple[ProfileOption, ...]
            Task-specific options.
        """

    @abstractmethod
    def loading_signature(self) -> tuple[str, ...]:
        """
        What a loaded model depends on; models with equal signatures share loaded weights.

        Returns
        -------
        tuple[str, ...]
            Values that require reloading when they change.
        """

    @abstractmethod
    def as_selection(self) -> ModelSelection:
        """
        Selection reproducing these settings.

        Returns
        -------
        ModelSelection
            Preset with every override set to the current value.
        """

    def fitted(self, selection: ModelSelection) -> ModelSelection:
        """
        Selection of this model with the options it does not take cleared.

        Parameters
        ----------
        selection : ModelSelection
            Selection of the preset of this model.

        Returns
        -------
        ModelSelection
            ``selection`` unless a subclass ignores some of its options.

        Raises
        ------
        ValueError
            If a subclass does not offer an option of the selection.
        """
        return selection

    @abstractmethod
    def customized(
        self, selection: ModelSelection, box_detector_of: Callable[[str], "DetectionModel"]
    ) -> "RecognitionModel":
        """
        Same preset with the overrides of a selection.

        Parameters
        ----------
        selection : ModelSelection
            Overrides to apply.
        box_detector_of : Callable[[str], DetectionModel]
            Detection preset of a box detector label, read only by models masking the boxes of a detector.

        Returns
        -------
        RecognitionModel
            Model with the overrides applied.
        """

    @abstractmethod
    def build_recognizer(self) -> "Recognizer[RecognitionModel]":
        """
        Load the model.

        Returns
        -------
        Recognizer[RecognitionModel]
            Loaded model ready to recognize.
        """

    def profile(self) -> ModelProfile:
        """
        Profile of the results this model recognizes.

        Returns
        -------
        ModelProfile
            Task, model, device, precision and options.
        """
        return ModelProfile(
            task=self.TASK,
            backend=self.backend,
            model_name=self._preset.name,
            weights_path=self.weights_path,
            device=self.device.value,
            precision=self.precision.short_name,
            options=self.options,
            query_kinds=self.supported_query_kinds,
            is_sequential=self.is_sequential,
        )

    @staticmethod
    def format_threshold(value: float | None) -> str:
        """
        Threshold as shown in profiles.

        Parameters
        ----------
        value : float | None
            Threshold, or ``None`` when disabled.

        Returns
        -------
        str
            Shortest decimal form, or ``"off"``.
        """
        return "off" if value is None else f"{value:g}"
