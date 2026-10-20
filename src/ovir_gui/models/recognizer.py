from abc import ABC, abstractmethod
from collections.abc import Sequence

from ..media import KeyedPicture
from ..prompting import LabeledPrompt
from ..recognition import FrameResult
from .recognition_model import RecognitionModel


class Recognizer(ABC):
    """
    Loaded model turning images and a prompt into library-independent ``FrameResult``s.

    A recognizer is used from one thread at a time. ``adopt`` takes settings that differ only in what is read at
    inference time, such as thresholds, without loading the model again.
    """

    @property
    @abstractmethod
    def model(self) -> RecognitionModel:
        """
        Settings the recognizer runs with.

        Returns
        -------
        RecognitionModel
            Model last loaded or adopted.
        """

    @abstractmethod
    def adopt(self, model: RecognitionModel) -> None:
        """
        Run with other settings of the same loaded model.

        Parameters
        ----------
        model : RecognitionModel
            Settings with the same ``loading_signature``.

        Raises
        ------
        TypeError
            If the model is of another task.
        ValueError
            If the model would need loading other weights.
        """

    @abstractmethod
    def recognize(self, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt) -> list[FrameResult]:
        """
        Recognize what the prompt asks for in some pictures.

        Parameters
        ----------
        pictures : Sequence[KeyedPicture]
            RGB pictures with their keys, processed in mini-batches of the model's batch size; a sequential model
            receives the frames of a video in ascending order.
        prompt : LabeledPrompt
            Classes with their queries and the drawings of the pictures.

        Returns
        -------
        list[FrameResult]
            One result per image, in input order.
        """

    def require_reusable(self, model: RecognitionModel) -> None:
        """
        Check that settings can run on the loaded weights.

        Parameters
        ----------
        model : RecognitionModel
            Settings to adopt.

        Raises
        ------
        ValueError
            If the loading signatures differ.
        """
        if model.loading_signature() != self.model.loading_signature():
            raise ValueError(f"{model.preset.label} needs loading other weights than {self.model.preset.label}.")
