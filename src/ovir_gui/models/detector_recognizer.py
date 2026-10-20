from collections.abc import Sequence

import numpy as np
from open_vocabulary_detector import DetectionResult, OpenVocabularyDetector, Prompt

from ..media import KeyedPicture
from ..prompting import LabeledPrompt
from ..recognition import FrameResult, ImageSize, PixelBox, RecognitionTask, RecognizedInstance
from .detection_model import DetectionModel
from .detector_prompt_builder import DetectorPromptBuilder
from .recognition_model import RecognitionModel
from .recognizer import Recognizer


class DetectorRecognizer(Recognizer):
    """
    Loaded ``open_vocabulary_detector`` detector.
    """

    def __init__(self, model: DetectionModel) -> None:
        """
        Load the detector.

        Parameters
        ----------
        model : DetectionModel
            Settings to load.
        """
        self._model: DetectionModel = model
        self._detector: OpenVocabularyDetector = model.settings.build()
        self._prompts: DetectorPromptBuilder = DetectorPromptBuilder()

    @property
    def model(self) -> RecognitionModel:
        return self._model

    def adopt(self, model: RecognitionModel) -> None:
        if not isinstance(model, DetectionModel):
            raise TypeError(f"a detector cannot run {model.task.value} settings.")
        self.require_reusable(model)
        self._model = model
        self._detector.settings = model.settings

    def recognize(self, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt) -> list[FrameResult]:
        library_prompt: Prompt = self._prompts.build(prompt)
        query_labels: tuple[str, ...] = prompt.query_labels
        results: list[DetectionResult] = self._detector.detect_images(
            [picture.image for picture in pictures], library_prompt
        )
        return [self._convert(result, query_labels) for result in results]

    @staticmethod
    def _convert(result: DetectionResult, query_labels: tuple[str, ...]) -> FrameResult:
        xyxy: list[list[float]] = np.asarray(result.xyxy, dtype=np.float64).reshape(-1, 4).tolist()
        class_ids: list[int] = [int(class_id) for class_id in result.class_ids.tolist()]
        query_ids: list[int] = [int(query_id) for query_id in result.query_ids.tolist()]
        confidences: list[float] = [float(confidence) for confidence in result.confidences.tolist()]
        return FrameResult(
            task=RecognitionTask.DETECTION,
            image_size=ImageSize(width=result.image_size.width, height=result.image_size.height),
            instances=tuple(
                RecognizedInstance(
                    class_name=result.class_names[class_ids[index]],
                    query_label=query_labels[query_ids[index]],
                    confidence=confidences[index],
                    box=PixelBox.of(xyxy[index]),
                )
                for index in range(len(confidences))
            ),
        )
