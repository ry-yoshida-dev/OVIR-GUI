from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from open_vocabulary_classification import Prompt

from ..recognition import ClassifierLogits, SentenceLogit
from .prompt_sentence import PromptSentence


@dataclass(frozen=True)
class ClassifierQueryLayout:
    """
    Library prompt of a classifier with every sentence of the classes it holds the logit of.

    The library prompt has one class per distinct query, so its logits are read per sentence and the scores of the
    classes are computed outside the library.

    Attributes
    ----------
    prompt : Prompt
        Library prompt, one query per distinct sentence.
    sentences : tuple[PromptSentence, ...]
        Every sentence, grouped by class and prompt in prompt order, templates in template order.
    class_names : tuple[str, ...]
        Class names in class order.
    """

    prompt: Prompt
    sentences: tuple[PromptSentence, ...]
    class_names: tuple[str, ...]

    def logits_of(
        self,
        query_logits: NDArray[np.float64],
        prompt_labels: tuple[str, ...],
        logit_scale: float,
        logit_bias: float,
    ) -> ClassifierLogits:
        """
        Logit of every sentence of one picture.

        Parameters
        ----------
        query_logits : NDArray[np.float64]
            Logit of every query of ``prompt``, shape (Q,).
        prompt_labels : tuple[str, ...]
            Label of every prompt, indexed by ``PromptSentence.prompt_index``.
        logit_scale : float
            Scale of the classifier turning a cosine similarity into a logit.
        logit_bias : float
            Bias of the classifier turning a cosine similarity into a logit.

        Returns
        -------
        ClassifierLogits
            Sentences of the classes with their logits.

        Raises
        ------
        ValueError
            If ``query_logits`` does not hold one logit per query or a class has no sentence.
        """
        if query_logits.shape != (len(self.prompt.queries),):
            raise ValueError(f"query_logits must have shape ({len(self.prompt.queries)},). got {query_logits.shape}")
        return ClassifierLogits(
            class_names=self.class_names,
            prompt_labels=prompt_labels,
            sentences=tuple(
                SentenceLogit(
                    class_index=sentence.class_index,
                    prompt_index=sentence.prompt_index,
                    template=sentence.template,
                    logit=float(query_logits[sentence.query_index]),
                )
                for sentence in self.sentences
            ),
            logit_scale=logit_scale,
            logit_bias=logit_bias,
        )
