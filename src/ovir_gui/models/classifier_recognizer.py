from collections.abc import Sequence

from open_vocabulary_classification import ClassificationResult, OpenVocabularyClassifier
from PIL import Image

from ..media import KeyedPicture
from ..prompting import LabeledPrompt
from ..recognition import ClassifierLogits, FrameResult, ImageSize, LabelMode, RecognitionTask
from .classification_model import ClassificationModel
from .classifier_prompt_builder import ClassifierPromptBuilder
from .classifier_query_layout import ClassifierQueryLayout
from .recognizer import Recognizer
from .template_scorer import TemplateScorer


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
        layout: ClassifierQueryLayout = self._prompts.build(prompt, self._model.text_templates)
        results: list[ClassificationResult] = self._classifier.classify_images(
            images, layout.prompt, self._model.tiling
        )
        scorer: TemplateScorer = TemplateScorer(self._model.template_combination, self._classifier.score_activation)
        frame_results: list[FrameResult] = []
        for image, result in zip(images, results, strict=True):
            logits: ClassifierLogits = layout.logits_of(
                result.query_logits, prompt.prompt_labels, self._classifier.logit_scale, self._classifier.logit_bias
            )
            frame_results.append(
                FrameResult(
                    task=RecognitionTask.CLASSIFICATION,
                    image_size=ImageSize(width=image.width, height=image.height),
                    class_scores=scorer.class_scores(logits),
                    native_label_mode=self._native_label_mode,
                    sentence_logits=logits,
                )
            )
        return frame_results
