from collections.abc import Sequence

from open_vocabulary_classification import ClassificationResult, OpenVocabularyClassifier, Prompt
from PIL import Image

from ..prompting import LabeledPrompt
from ..recognition import ClassScore, FrameResult, ImageSize, RecognitionTask
from .classification_model import ClassificationModel
from .classifier_prompt_builder import ClassifierPromptBuilder
from .recognition_model import RecognitionModel
from .recognizer import Recognizer


class ClassifierRecognizer(Recognizer):
    """
    Loaded ``open_vocabulary_classification`` classifier.
    """

    def __init__(self, model: ClassificationModel) -> None:
        """
        Load the classifier.

        Parameters
        ----------
        model : ClassificationModel
            Settings to load.
        """
        self._model: ClassificationModel = model
        self._classifier: OpenVocabularyClassifier = model.settings.build()
        self._prompts: ClassifierPromptBuilder = ClassifierPromptBuilder()

    @property
    def model(self) -> RecognitionModel:
        return self._model

    def adopt(self, model: RecognitionModel) -> None:
        if not isinstance(model, ClassificationModel):
            raise TypeError(f"a classifier cannot run {model.task.value} settings.")
        self.require_reusable(model)
        self._model = model
        self._classifier.settings = model.settings

    def recognize(self, images: Sequence[Image.Image], prompt: LabeledPrompt) -> list[FrameResult]:
        library_prompt: Prompt = self._prompts.build(prompt)
        query_labels: tuple[str, ...] = prompt.query_labels
        results: list[ClassificationResult] = self._classifier.classify_images(
            images, library_prompt, self._model.tiling
        )
        return [
            self._convert(result, query_labels, ImageSize(width=image.width, height=image.height))
            for image, result in zip(images, results, strict=True)
        ]

    @staticmethod
    def _convert(result: ClassificationResult, query_labels: tuple[str, ...], image_size: ImageSize) -> FrameResult:
        matched_query_ids: list[int] = [int(query_id) for query_id in result.matched_query_ids.tolist()]
        return FrameResult(
            task=RecognitionTask.CLASSIFICATION,
            image_size=image_size,
            class_scores=tuple(
                ClassScore(
                    class_name=class_name,
                    score=float(result.scores[class_id]),
                    logit=float(result.class_logits[class_id]),
                    query_label=query_labels[matched_query_ids[class_id]],
                )
                for class_id, class_name in enumerate(result.class_names)
            ),
        )
