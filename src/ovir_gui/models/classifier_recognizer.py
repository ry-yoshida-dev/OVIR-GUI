from collections.abc import Sequence

from open_vocabulary_classification import ClassificationResult, OpenVocabularyClassifier, Prompt
from PIL import Image

from ..media import KeyedPicture
from ..prompting import LabeledPrompt
from ..recognition import ClassScore, FrameResult, ImageSize, LabelMode, RecognitionTask
from .classification_model import ClassificationModel
from .classifier_prompt_builder import ClassifierPromptBuilder
from .recognizer import Recognizer


class ClassifierRecognizer(Recognizer[ClassificationModel]):
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
        super().__init__(model, ClassificationModel)
        self._classifier: OpenVocabularyClassifier = model.settings.build()
        self._prompts: ClassifierPromptBuilder = ClassifierPromptBuilder()
        self._native_label_mode: LabelMode = ClassificationModel.native_label_mode_of(model.backend)

    def _apply_model(self) -> None:
        self._classifier.settings = self._model.settings

    def recognize(self, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt) -> list[FrameResult]:
        images: list[Image.Image] = [picture.image for picture in pictures]
        library_prompt: Prompt = self._prompts.build(prompt)
        query_labels: tuple[str, ...] = prompt.query_labels
        results: list[ClassificationResult] = self._classifier.classify_images(
            images, library_prompt, self._model.tiling
        )
        return [
            self._convert(result, query_labels, ImageSize(width=image.width, height=image.height))
            for image, result in zip(images, results, strict=True)
        ]

    def _convert(
        self, result: ClassificationResult, query_labels: tuple[str, ...], image_size: ImageSize
    ) -> FrameResult:
        matched_query_ids: list[int] = [int(query_id) for query_id in result.matched_query_ids.tolist()]
        logit_scale: float = self._classifier.logit_scale
        logit_bias: float = self._classifier.logit_bias
        return FrameResult(
            task=RecognitionTask.CLASSIFICATION,
            image_size=image_size,
            class_scores=tuple(
                ClassScore(
                    class_name=class_name,
                    score=float(result.scores[class_id]),
                    logit=float(result.class_logits[class_id]),
                    query_label=query_labels[matched_query_ids[class_id]],
                    similarity=(float(result.class_logits[class_id]) - logit_bias) / logit_scale,
                )
                for class_id, class_name in enumerate(result.class_names)
            ),
            native_label_mode=self._native_label_mode,
        )
