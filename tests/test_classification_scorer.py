import math

import numpy as np
import pytest
from numpy.typing import NDArray
from open_vocabulary_classification import (
    AggregationMethod,
    AggregationStep,
    AggregationTiming,
    AggregationUnit,
    ClassificationResult,
    EmbeddingLayout,
    LogitAggregation,
    PromptAggregation,
    ScoreActivation,
    TextQuery,
    TextTemplates,
)

from ovir_gui.models import ClassificationScorer
from ovir_gui.models.classifier_prompt_builder import ClassifierPromptBuilder
from ovir_gui.models.classifier_query_layout import ClassifierQueryLayout
from ovir_gui.prompting import LabeledPrompt, PromptClass, PromptSignature, QueryKind
from ovir_gui.recognition import ClassifierLogits, ClassScore, FrameResult, ImageSize, RecognitionTask

PHOTO_TEMPLATE: str = "a photo of a {}."
TEMPLATES: TextTemplates = TextTemplates(("{}", PHOTO_TEMPLATE))
LOGITS: NDArray[np.float64] = np.array([1.0, 3.0, 2.5, 2.0, 0.0, 4.0])
PROMPT: LabeledPrompt = LabeledPrompt(
    classes=(
        PromptClass(name="dog", phrases=("dog", "puppy", "Dog"), visual_examples=()),
        PromptClass(name="cat", phrases=("cat",), visual_examples=()),
    ),
    class_signature=PromptSignature(()),
    query_kinds=frozenset({QueryKind.TEXT}),
)


def aggregation(*specifications: str) -> PromptAggregation:
    steps: list[AggregationStep] = []
    for specification in specifications:
        unit, timing, method = specification.split(":")
        steps.append(AggregationStep(AggregationUnit(unit), AggregationTiming(timing), AggregationMethod(method)))
    return PromptAggregation.of(steps)


EVERY_SENTENCE: PromptAggregation = PromptAggregation.of([])


def logits(
    embedding: PromptAggregation = EVERY_SENTENCE, sentence_logits: NDArray[np.float64] = LOGITS
) -> ClassifierLogits:
    query_layout: ClassifierQueryLayout = ClassifierPromptBuilder().build(PROMPT)
    layout: EmbeddingLayout = EmbeddingLayout.of(query_layout.prompt, TEMPLATES, embedding)
    result: ClassificationResult = ClassificationResult(
        layout=layout,
        aggregation=LogitAggregation.of(layout),
        embedding_logits=sentence_logits[: len(layout)],
        score_activation=ScoreActivation.SOFTMAX,
    )
    return query_layout.logits_of(result, PROMPT, logit_scale=1.0, logit_bias=0.0)


def scores_of(similarity: PromptAggregation, activation: ScoreActivation) -> tuple[ClassScore, ...]:
    return ClassificationScorer(similarity, activation).class_scores(logits())


def softmax_share(logit: float, every_logit: list[float]) -> float:
    return math.exp(logit) / sum(math.exp(value) for value in every_logit)


class TestClassificationScorer:
    """
    The steps on similarities of an aggregation reduce the stored logits of the text vectors of every class to its
    candidates, and a class takes its best candidate.
    """

    def test_phrases_equal_but_for_case_are_one_query_named_by_the_first(self) -> None:
        query_layout: ClassifierQueryLayout = ClassifierPromptBuilder().build(PROMPT)
        assert [query.text for query in query_layout.prompt.queries if isinstance(query, TextQuery)] == [
            "dog",
            "puppy",
            "cat",
        ]
        assert query_layout.query_prompt_indices == (0, 1, 3)
        assert logits().prompt_labels == ("dog", "puppy", "Dog", "cat")

    def test_max_over_templates_then_prompts_takes_the_best_sentence(self) -> None:
        dog, cat = scores_of(aggregation("template:similarity:max", "prompt:similarity:max"), ScoreActivation.SOFTMAX)
        assert (dog.matched_prompt, dog.matched_template, dog.logit) == ("dog", PHOTO_TEMPLATE, 3.0)
        assert dog.score == pytest.approx(softmax_share(3.0, [3.0, 4.0]))
        assert cat.score == pytest.approx(softmax_share(4.0, [3.0, 4.0]))

    def test_mean_over_templates_picks_the_prompt_with_the_best_mean_and_its_best_template(self) -> None:
        dog, cat = scores_of(aggregation("template:similarity:mean", "prompt:similarity:max"), ScoreActivation.SOFTMAX)
        assert (dog.matched_prompt, dog.matched_template, dog.logit) == ("puppy", "{}", 2.25)
        assert cat.logit == pytest.approx(2.0)

    def test_without_steps_every_sentence_is_a_candidate(self) -> None:
        dog, cat = scores_of(EVERY_SENTENCE, ScoreActivation.SOFTMAX)
        every_logit: list[float] = [float(logit) for logit in LOGITS]
        assert (dog.matched_prompt, dog.matched_template) == ("dog", PHOTO_TEMPLATE)
        assert dog.score == pytest.approx(softmax_share(3.0, every_logit))
        assert cat.score == pytest.approx(softmax_share(4.0, every_logit))

    def test_scores_match_the_classifier_with_the_same_aggregation(self) -> None:
        steps: PromptAggregation = aggregation("template_and_prompt:similarity:median")
        query_layout: ClassifierQueryLayout = ClassifierPromptBuilder().build(PROMPT)
        layout: EmbeddingLayout = EmbeddingLayout.of(query_layout.prompt, TEMPLATES, steps)
        result: ClassificationResult = ClassificationResult(
            layout=layout,
            aggregation=LogitAggregation.of(layout),
            embedding_logits=LOGITS,
            score_activation=ScoreActivation.SIGMOID,
        )
        scores: tuple[ClassScore, ...] = scores_of(steps, ScoreActivation.SIGMOID)
        assert [score.score for score in scores] == pytest.approx(result.scores.tolist())

    def test_merged_prompts_report_no_matched_prompt(self) -> None:
        merged: ClassifierLogits = logits(aggregation("prompt:embedding:mean"), np.array([1.0, 2.0, 0.0, -1.0]))
        assert [(vector.prompt_index, vector.template) for vector in merged.embeddings] == [
            (None, "{}"),
            (None, PHOTO_TEMPLATE),
            (None, "{}"),
            (None, PHOTO_TEMPLATE),
        ]
        dog, _ = ClassificationScorer(aggregation("template:similarity:max"), ScoreActivation.SIGMOID).class_scores(
            merged
        )
        assert (dog.matched_prompt, dog.matched_template, dog.logit) == (None, PHOTO_TEMPLATE, 2.0)

    def test_rescoring_a_stored_result_changes_its_scores_without_its_logits(self) -> None:
        maximum: PromptAggregation = aggregation("template:similarity:max", "prompt:similarity:max")
        minimum: PromptAggregation = aggregation("template:similarity:min", "prompt:similarity:max")
        stored: FrameResult = FrameResult(
            task=RecognitionTask.CLASSIFICATION,
            image_size=ImageSize(width=4, height=3),
            class_scores=scores_of(maximum, ScoreActivation.SOFTMAX),
            embedding_logits=logits(),
        )
        rescored: FrameResult = ClassificationScorer(minimum, ScoreActivation.SOFTMAX).rescored(stored)
        assert rescored.class_scores == scores_of(minimum, ScoreActivation.SOFTMAX)
        assert rescored.embedding_logits is stored.embedding_logits
