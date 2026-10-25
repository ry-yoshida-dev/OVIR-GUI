import math

import numpy as np
import pytest
from numpy.typing import NDArray
from open_vocabulary_classification import Prompt, ScoreActivation, TextQuery

from ovir_gui.models import TemplateCombination
from ovir_gui.models.classifier_query_layout import ClassifierQueryLayout
from ovir_gui.models.prompt_sentence import PromptSentence
from ovir_gui.models.template_scorer import TemplateScorer
from ovir_gui.recognition import ClassifierLogits, ClassScore, FrameResult, ImageSize, RecognitionTask

PHOTO_TEMPLATE: str = "a photo of a {}."
PROMPT_LABELS: tuple[str, ...] = ("dog", "puppy", "cat")
LOGITS: NDArray[np.float64] = np.array([1.0, 3.0, 2.5, 2.0, 0.0, 4.0])


def layout() -> ClassifierQueryLayout:
    sentences: list[PromptSentence] = []
    texts: list[str] = []
    for class_index, prompt_index in ((0, 0), (0, 1), (1, 2)):
        for template in ("{}", PHOTO_TEMPLATE):
            sentences.append(PromptSentence(class_index, prompt_index, template, len(texts)))
            texts.append(template.format(PROMPT_LABELS[prompt_index]))
    return ClassifierQueryLayout(
        prompt=Prompt({str(index): (TextQuery(text),) for index, text in enumerate(texts)}),
        sentences=tuple(sentences),
        class_names=("dog", "cat"),
    )


def logits() -> ClassifierLogits:
    return layout().logits_of(LOGITS, PROMPT_LABELS, logit_scale=1.0, logit_bias=0.0)


def scores_of(combination: TemplateCombination, activation: ScoreActivation) -> tuple[ClassScore, ...]:
    return TemplateScorer(combination, activation).class_scores(logits())


def softmax_share(logit: float, logits: list[float]) -> float:
    return math.exp(logit) / sum(math.exp(value) for value in logits)


class TestTemplateScorer:
    """
    A prompt's sentences combine into one logit before the activation, or compete on their own without a combination.
    """

    def test_max_takes_the_best_sentence_of_each_prompt(self) -> None:
        dog, cat = scores_of(TemplateCombination.MAX, ScoreActivation.SOFTMAX)
        assert (dog.matched_prompt, dog.matched_template, dog.logit) == ("dog", PHOTO_TEMPLATE, 3.0)
        assert dog.score == pytest.approx(softmax_share(3.0, [3.0, 4.0]))
        assert cat.score == pytest.approx(softmax_share(4.0, [3.0, 4.0]))

    def test_mean_picks_the_prompt_with_the_best_mean_and_its_best_template(self) -> None:
        dog, cat = scores_of(TemplateCombination.MEAN, ScoreActivation.SOFTMAX)
        assert (dog.matched_prompt, dog.matched_template, dog.logit) == ("puppy", "{}", 2.25)
        assert cat.logit == pytest.approx(2.0)
        assert dog.score == pytest.approx(softmax_share(2.25, [2.25, 2.0]))

    def test_min_takes_the_worst_sentence_of_each_prompt(self) -> None:
        dog, cat = scores_of(TemplateCombination.MIN, ScoreActivation.SOFTMAX)
        assert (dog.matched_prompt, dog.logit, cat.logit) == ("puppy", 2.0, 0.0)

    def test_none_runs_the_softmax_over_every_sentence(self) -> None:
        dog, cat = scores_of(TemplateCombination.NONE, ScoreActivation.SOFTMAX)
        every_logit: list[float] = [float(logit) for logit in LOGITS]
        assert (dog.matched_prompt, dog.matched_template) == ("dog", PHOTO_TEMPLATE)
        assert dog.score == pytest.approx(softmax_share(3.0, every_logit))
        assert cat.score == pytest.approx(softmax_share(4.0, every_logit))

    def test_none_equals_max_for_a_sigmoid(self) -> None:
        unmerged: tuple[ClassScore, ...] = scores_of(TemplateCombination.NONE, ScoreActivation.SIGMOID)
        merged: tuple[ClassScore, ...] = scores_of(TemplateCombination.MAX, ScoreActivation.SIGMOID)
        assert [score.score for score in unmerged] == pytest.approx([score.score for score in merged])

    def test_rescoring_a_stored_result_changes_its_scores_without_its_logits(self) -> None:
        stored: FrameResult = FrameResult(
            task=RecognitionTask.CLASSIFICATION,
            image_size=ImageSize(width=4, height=3),
            class_scores=scores_of(TemplateCombination.MAX, ScoreActivation.SOFTMAX),
            sentence_logits=logits(),
        )
        rescored: FrameResult = TemplateScorer(TemplateCombination.MIN, ScoreActivation.SOFTMAX).rescored(stored)
        assert rescored.class_scores == scores_of(TemplateCombination.MIN, ScoreActivation.SOFTMAX)
        assert rescored.sentence_logits is stored.sentence_logits
