import gc
from collections.abc import Sequence
from time import perf_counter

from ..media import KeyedPicture
from ..prompting import LabeledPrompt
from ..recognition import FrameResult
from .recognition_model import RecognitionModel
from .recognition_outcome import RecognitionOutcome
from .recognizer import Recognizer


class RecognizerSession:
    """
    Keeps one loaded model and switches it only when the requested model needs other weights.

    Settings differing only in what is read at inference time, such as thresholds or batch size, reuse the loaded
    model. Switching releases the previous model before loading the next, so two models never share the device.
    """

    def __init__(self) -> None:
        self._recognizer: Recognizer[RecognitionModel] | None = None

    @property
    def loaded_model(self) -> RecognitionModel | None:
        """
        Settings of the loaded model.

        Returns
        -------
        RecognitionModel | None
            ``None`` while no model is loaded.
        """
        return None if self._recognizer is None else self._recognizer.model

    def is_loaded_for(self, model: RecognitionModel) -> bool:
        """
        Whether a model can run without loading.

        Parameters
        ----------
        model : RecognitionModel
            Requested settings.

        Returns
        -------
        bool
            True when the loaded model has the same loading signature.
        """
        loaded_model: RecognitionModel | None = self.loaded_model
        return loaded_model is not None and loaded_model.loading_signature() == model.loading_signature()

    def recognize(
        self, model: RecognitionModel, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt
    ) -> RecognitionOutcome:
        """
        Recognize pictures, loading the requested model first if needed.

        Parameters
        ----------
        model : RecognitionModel
            Settings to run with.
        pictures : Sequence[KeyedPicture]
            RGB pictures with their keys.
        prompt : LabeledPrompt
            Classes with their queries and the drawings of the pictures.

        Returns
        -------
        RecognitionOutcome
            One result per image with the inference time.
        """
        is_model_reloaded: bool = not self.is_loaded_for(model)
        recognizer: Recognizer[RecognitionModel] = self._prepare(model)
        started_at: float = perf_counter()
        results: tuple[FrameResult, ...] = tuple(recognizer.recognize(pictures, prompt))
        return RecognitionOutcome(
            results=results,
            inference_seconds=perf_counter() - started_at,
            is_model_reloaded=is_model_reloaded,
        )

    def unload(self) -> None:
        """
        Release the loaded model.
        """
        self._recognizer = None
        gc.collect()

    def _prepare(self, model: RecognitionModel) -> Recognizer[RecognitionModel]:
        if self._recognizer is not None and self.is_loaded_for(model):
            self._recognizer.adopt(model)
            return self._recognizer
        self.unload()
        self._recognizer = model.build_recognizer()
        return self._recognizer
