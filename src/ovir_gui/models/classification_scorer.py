from dataclasses import replace

import numpy as np
from numpy.typing import NDArray
from open_vocabulary_classification import (
    ClassScores,
    EntryLabel,
    LogitAggregation,
    PromptAggregation,
    ScoreActivation,
)

from ..recognition import ClassifierLogits, ClassScore, EmbeddingLogit, FrameResult


class ClassificationScorer:
    """
    Class scores of a classifier from the logits of the text vectors of every class.

    The aggregation steps on similarities reduce the logits of every class to its candidates, the activation runs over
    every candidate and a class takes its best candidate, as the classifier scores them. Steps on text vectors are not
    read: they made the vectors the logits belong to. The logits are kept with the result, so stored results are scored
    again whenever the steps on similarities change.
    """

    def __init__(self, aggregation: PromptAggregation, activation: ScoreActivation) -> None:
        """
        Parameters
        ----------
        aggregation : PromptAggregation
            Aggregation whose steps on similarities reduce the logits.
        activation : ScoreActivation
            Activation of the classifier turning logits into scores.
        """
        self._aggregation: PromptAggregation = aggregation
        self._activation: ScoreActivation = activation
        self._prepared: dict[tuple[EntryLabel, ...], LogitAggregation] = {}

    def class_scores(self, logits: ClassifierLogits) -> tuple[ClassScore, ...]:
        """
        Score of every class of one picture.

        Parameters
        ----------
        logits : ClassifierLogits
            Logit of every text vector of the picture.

        Returns
        -------
        tuple[ClassScore, ...]
            Scores in class order.
        """
        embeddings: tuple[EmbeddingLogit, ...] = logits.embeddings
        labels: tuple[EntryLabel, ...] = tuple(
            EntryLabel(embedding.class_index, embedding.prompt_index, embedding.template) for embedding in embeddings
        )
        aggregation: LogitAggregation | None = self._prepared.get(labels)
        if aggregation is None:
            aggregation = LogitAggregation(labels, self._aggregation)
            self._prepared[labels] = aggregation
        embedding_logits: NDArray[np.float64] = np.asarray(
            [embedding.logit for embedding in embeddings], dtype=np.float64
        )
        scores: ClassScores = ClassScores.of(aggregation, embedding_logits, self._activation)
        class_scores: list[ClassScore] = []
        for class_index, class_name in enumerate(logits.class_names):
            matched: EmbeddingLogit = embeddings[int(scores.matched_entry_ids[class_index])]
            logit: float = float(scores.class_logits[class_index])
            class_scores.append(
                ClassScore(
                    class_name=class_name,
                    score=float(scores.scores[class_index]),
                    logit=logit,
                    matched_prompt=logits.prompt_label_of(matched),
                    similarity=logits.similarity_of(logit),
                    matched_template=matched.template,
                )
            )
        return tuple(class_scores)

    def rescored(self, result: FrameResult) -> FrameResult:
        """
        Same result scored with the steps on similarities of this scorer.

        Parameters
        ----------
        result : FrameResult
            Stored result of a classifier.

        Returns
        -------
        FrameResult
            Copy with the class scores computed again; ``result`` itself when it holds no embedding logits.
        """
        if result.embedding_logits is None:
            return result
        return replace(result, class_scores=self.class_scores(result.embedding_logits))
