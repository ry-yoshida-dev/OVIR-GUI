from collections.abc import Sequence
from threading import Lock
from typing import ClassVar

from ovir_gui.media import KeyedPicture
from ovir_gui.models import RecognitionModel, RecognitionOutcome, RecognizerSession
from ovir_gui.prompting import LabeledPrompt
from ovir_gui.recognition import (
    ClassScore,
    FrameResult,
    ImageSize,
    PixelBox,
    RecognitionTask,
    RecognizedInstance,
)


class FakeRecognizerSession(RecognizerSession):
    """
    Recognizer session answering every picture with deterministic results, without loading any weights.

    A detection finds every prompted class once, plus a weaker overlapping duplicate of the first class; a
    classification scores every prompted class. Confidences depend on the class position and the frame index, so
    pictures differ.
    """

    DUPLICATE_CONFIDENCE: ClassVar[float] = 0.5

    def __init__(self) -> None:
        super().__init__()
        self._lock: Lock = Lock()
        self._recognized_count: int = 0

    @property
    def recognized_count(self) -> int:
        """
        Pictures recognized so far.

        Returns
        -------
        int
            Count over every call.
        """
        with self._lock:
            return self._recognized_count

    def is_loaded_for(self, model: RecognitionModel) -> bool:
        """
        Report every model as loaded.

        Parameters
        ----------
        model : RecognitionModel
            Requested settings.

        Returns
        -------
        bool
            Always True.
        """
        return True

    def recognize(
        self, model: RecognitionModel, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt
    ) -> RecognitionOutcome:
        """
        Answer pictures with deterministic results.

        Parameters
        ----------
        model : RecognitionModel
            Settings deciding the task.
        pictures : Sequence[KeyedPicture]
            Pictures with their keys.
        prompt : LabeledPrompt
            Classes to find.

        Returns
        -------
        RecognitionOutcome
            One result per picture.
        """
        with self._lock:
            self._recognized_count += len(pictures)
        results: tuple[FrameResult, ...] = tuple(self._result_of(model.task, picture, prompt) for picture in pictures)
        return RecognitionOutcome(results=results, inference_seconds=0.0, is_model_reloaded=False)

    def _result_of(self, task: RecognitionTask, picture: KeyedPicture, prompt: LabeledPrompt) -> FrameResult:
        width: int
        height: int
        width, height = picture.image.size
        size: ImageSize = ImageSize(width, height)
        frame_offset: float = 0.01 * (picture.frame_key.frame_index or 0)
        names: list[str] = [prompt_class.name for prompt_class in prompt.classes]
        if task is RecognitionTask.CLASSIFICATION:
            return FrameResult(
                task=task,
                image_size=size,
                class_scores=tuple(
                    ClassScore(
                        class_name=name,
                        score=round(0.9 - 0.2 * position - frame_offset, 4),
                        logit=float(position),
                        query_label=name,
                        similarity=round(0.3 - 0.05 * position, 4),
                    )
                    for position, name in enumerate(names)
                ),
            )
        instances: list[RecognizedInstance] = [
            RecognizedInstance(
                class_name=name,
                query_label=name,
                confidence=round(0.9 - 0.2 * position - frame_offset, 4),
                box=PixelBox(2.0 + 8.0 * position, 2.0, 10.0 + 8.0 * position, 20.0),
            )
            for position, name in enumerate(names)
        ]
        if names:
            instances.append(
                RecognizedInstance(
                    class_name=names[0],
                    query_label=names[0],
                    confidence=self.DUPLICATE_CONFIDENCE,
                    box=PixelBox(3.0, 2.0, 11.0, 20.0),
                )
            )
        return FrameResult(
            task=task,
            image_size=size,
            instances=tuple(sorted(instances, key=lambda instance: -instance.confidence)),
        )
