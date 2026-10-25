from dataclasses import replace
from itertools import groupby

import numpy as np
from numpy.typing import NDArray
from open_vocabulary_classification import ScoreActivation

from ..recognition import ClassifierLogits, ClassScore, FrameResult, SentenceLogit
from .template_combination import TemplateCombination


class TemplateScorer:
    """
    Class scores of a classifier from the logits of the sentences of every class.

    A class takes its best prompt, as the classifier reports it. With a combination, the sentences of a prompt become
    one logit first and the activation runs over the class logits; without one, the activation runs over every
    sentence and a class takes its best sentence. Either way the reported template is the best sentence of the
    matched prompt. The logits are kept with the result, so stored results are scored again whenever the
    combination changes.
    """

    def __init__(self, combination: TemplateCombination, activation: ScoreActivation) -> None:
        """
        Parameters
        ----------
        combination : TemplateCombination
            How the sentences of a prompt turn into its score.
        activation : ScoreActivation
            Activation of the classifier turning logits into scores.
        """
        self._combination: TemplateCombination = combination
        self._activation: ScoreActivation = activation

    def class_scores(self, logits: ClassifierLogits) -> tuple[ClassScore, ...]:
        """
        Score of every class of one picture.

        Parameters
        ----------
        logits : ClassifierLogits
            Logit of every sentence of the picture.

        Returns
        -------
        tuple[ClassScore, ...]
            Scores in class order.
        """
        sentences: tuple[SentenceLogit, ...] = logits.sentences
        sentence_logits: NDArray[np.float64] = np.asarray([sentence.logit for sentence in sentences], dtype=np.float64)
        class_prompts: list[list[list[int]]] = [[] for _ in logits.class_names]
        for (class_index, _), group in groupby(
            range(len(sentences)),
            key=lambda position: (sentences[position].class_index, sentences[position].prompt_index),
        ):
            class_prompts[class_index].append(list(group))
        if self._combination.is_combining:
            return self._combined_scores(logits, sentence_logits, class_prompts)
        return self._sentence_scores(logits, sentence_logits, class_prompts)

    def rescored(self, result: FrameResult) -> FrameResult:
        """
        Same result scored with the combination of this scorer.

        Parameters
        ----------
        result : FrameResult
            Stored result of a classifier.

        Returns
        -------
        FrameResult
            Copy with the class scores computed again; ``result`` itself when it holds no sentence logits.
        """
        if result.sentence_logits is None:
            return result
        return replace(result, class_scores=self.class_scores(result.sentence_logits))

    def _combined_scores(
        self,
        logits: ClassifierLogits,
        sentence_logits: NDArray[np.float64],
        class_prompts: list[list[list[int]]],
    ) -> tuple[ClassScore, ...]:
        matched: list[list[int]] = []
        class_logits: list[float] = []
        for prompts in class_prompts:
            prompt_logits: list[float] = [
                self._combination.combine(sentence_logits[positions]) for positions in prompts
            ]
            best: int = int(np.argmax(prompt_logits))
            matched.append(prompts[best])
            class_logits.append(prompt_logits[best])
        combined: NDArray[np.float64] = np.asarray(class_logits, dtype=np.float64)
        scores: NDArray[np.float64] = self._activation.apply(combined)
        return tuple(
            self._class_score(
                logits,
                class_index,
                float(scores[class_index]),
                float(combined[class_index]),
                self._best_of(positions, sentence_logits),
            )
            for class_index, positions in enumerate(matched)
        )

    def _sentence_scores(
        self,
        logits: ClassifierLogits,
        sentence_logits: NDArray[np.float64],
        class_prompts: list[list[list[int]]],
    ) -> tuple[ClassScore, ...]:
        scores: NDArray[np.float64] = self._activation.apply(sentence_logits)
        best_positions: list[int] = [
            self._best_of([position for positions in prompts for position in positions], sentence_logits)
            for prompts in class_prompts
        ]
        return tuple(
            self._class_score(
                logits,
                class_index,
                float(scores[position]),
                float(sentence_logits[position]),
                position,
            )
            for class_index, position in enumerate(best_positions)
        )

    @staticmethod
    def _best_of(positions: list[int], sentence_logits: NDArray[np.float64]) -> int:
        return positions[int(np.argmax(sentence_logits[positions]))]

    @staticmethod
    def _class_score(
        logits: ClassifierLogits, class_index: int, score: float, logit: float, best_position: int
    ) -> ClassScore:
        best: SentenceLogit = logits.sentences[best_position]
        return ClassScore(
            class_name=logits.class_names[class_index],
            score=score,
            logit=logit,
            matched_prompt=logits.prompt_labels[best.prompt_index],
            similarity=logits.similarity_of(logit),
            matched_template=best.template,
        )
