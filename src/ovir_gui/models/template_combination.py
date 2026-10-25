from enum import Enum

import numpy as np
from numpy.typing import NDArray


class TemplateCombination(Enum):
    """
    How the sentences one prompt of a classifier is filled into, one per text template, turn into its score.

    Attributes
    ----------
    NONE : str
        Every sentence is scored on its own: a softmax runs over the sentences of every class, and a class takes its
        best sentence.
    MAX : str
        A prompt takes the highest logit of its sentences.
    MEAN : str
        A prompt takes the mean logit of its sentences.
    MEDIAN : str
        A prompt takes the median logit of its sentences.
    MIN : str
        A prompt takes the lowest logit of its sentences.
    """

    NONE = "none"
    MAX = "max"
    MEAN = "mean"
    MEDIAN = "median"
    MIN = "min"

    @property
    def title(self) -> str:
        """
        Name shown in the template settings.

        Returns
        -------
        str
            E.g. ``"Median"``.
        """
        return str(self.value).capitalize()

    @property
    def is_combining(self) -> bool:
        """
        Whether the sentences of a prompt become one logit before the scores are computed.

        Returns
        -------
        bool
            False only for ``NONE``.
        """
        return self is not TemplateCombination.NONE

    def combine(self, logits: NDArray[np.float64]) -> float:
        """
        Logit of a prompt from the logits of its sentences.

        Parameters
        ----------
        logits : NDArray[np.float64]
            Logit of every sentence of the prompt, shape (T,).

        Returns
        -------
        float
            Combined logit.

        Raises
        ------
        ValueError
            If there is no logit, or for ``NONE``, which scores the sentences without combining them.
        """
        if logits.size == 0:
            raise ValueError("a prompt needs at least one sentence logit.")
        match self:
            case TemplateCombination.NONE:
                raise ValueError("sentences are not combined when the template combination is none.")
            case TemplateCombination.MAX:
                return float(logits.max())
            case TemplateCombination.MEAN:
                return float(logits.mean())
            case TemplateCombination.MEDIAN:
                return float(np.median(logits))
            case TemplateCombination.MIN:
                return float(logits.min())
