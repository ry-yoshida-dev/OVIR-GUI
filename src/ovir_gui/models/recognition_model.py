from abc import ABC, abstractmethod
from typing import TYPE_CHECKING, ClassVar

from ..prompting import PromptMode, QueryKind
from ..recognition import RecognitionTask
from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision
from .model_preset import ModelPreset
from .model_profile import ModelProfile
from .model_selection import ModelSelection
from .profile_option import ProfileOption

if TYPE_CHECKING:
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

    @abstractmethod
    def build_recognizer(self) -> "Recognizer":
        """
        Load the model.

        Returns
        -------
        Recognizer
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
