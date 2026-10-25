from dataclasses import dataclass

from .sentence_logit import SentenceLogit


@dataclass(frozen=True, eq=False)
class ClassifierLogits:
    """
    Logit of every sentence a classifier scored for one picture, kept so the class scores can be computed again with
    another template combination without recognizing again.

    Attributes
    ----------
    class_names : tuple[str, ...]
        Class names in class order.
    prompt_labels : tuple[str, ...]
        Label of every prompt, indexed by ``SentenceLogit.prompt_index``.
    sentences : tuple[SentenceLogit, ...]
        Every sentence, grouped by class and prompt in prompt order, templates in template order.
    logit_scale : float
        Scale of the classifier turning a cosine similarity into a logit.
    logit_bias : float
        Bias of the classifier turning a cosine similarity into a logit.

    Raises
    ------
    ValueError
        If a sentence indexes no class or prompt, a class has no sentence or the scale is not positive.
    """

    class_names: tuple[str, ...]
    prompt_labels: tuple[str, ...]
    sentences: tuple[SentenceLogit, ...]
    logit_scale: float
    logit_bias: float

    def __post_init__(self) -> None:
        if self.logit_scale <= 0.0:
            raise ValueError(f"logit_scale must be positive. got {self.logit_scale}")
        for sentence in self.sentences:
            if not 0 <= sentence.class_index < len(self.class_names):
                raise ValueError(f"sentence class must be in [0, {len(self.class_names)}). got {sentence.class_index}")
            if not 0 <= sentence.prompt_index < len(self.prompt_labels):
                raise ValueError(
                    f"sentence prompt must be in [0, {len(self.prompt_labels)}). got {sentence.prompt_index}"
                )
        if {sentence.class_index for sentence in self.sentences} != set(range(len(self.class_names))):
            raise ValueError("every class needs at least one sentence.")

    def similarity_of(self, logit: float) -> float:
        """
        Cosine similarity a logit stands for.

        Parameters
        ----------
        logit : float
            Logit of a sentence or a combined prompt.

        Returns
        -------
        float
            Similarity before the scale and bias of the classifier.
        """
        return (logit - self.logit_bias) / self.logit_scale
