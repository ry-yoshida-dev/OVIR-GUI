from dataclasses import dataclass

from .embedding_logit import EmbeddingLogit


@dataclass(frozen=True, eq=False)
class ClassifierLogits:
    """
    Logit of every text vector a classifier compared one picture with, kept so the class scores can be computed again
    with other aggregation steps on similarities without recognizing again.

    Attributes
    ----------
    class_names : tuple[str, ...]
        Class names in class order.
    prompt_labels : tuple[str, ...]
        Label of every prompt, indexed by ``EmbeddingLogit.prompt_index``.
    embeddings : tuple[EmbeddingLogit, ...]
        Every text vector, ordered by class.
    logit_scale : float
        Scale of the classifier turning a cosine similarity into a logit.
    logit_bias : float
        Bias of the classifier turning a cosine similarity into a logit.

    Raises
    ------
    ValueError
        If a vector indexes no class or prompt, the vectors are not ordered by class, a class has no vector or the
        scale is not positive.
    """

    class_names: tuple[str, ...]
    prompt_labels: tuple[str, ...]
    embeddings: tuple[EmbeddingLogit, ...]
    logit_scale: float
    logit_bias: float

    def __post_init__(self) -> None:
        if self.logit_scale <= 0.0:
            raise ValueError(f"logit_scale must be positive. got {self.logit_scale}")
        for embedding in self.embeddings:
            if not 0 <= embedding.class_index < len(self.class_names):
                raise ValueError(f"vector class must be in [0, {len(self.class_names)}). got {embedding.class_index}")
            if embedding.prompt_index is not None and not 0 <= embedding.prompt_index < len(self.prompt_labels):
                raise ValueError(
                    f"vector prompt must be in [0, {len(self.prompt_labels)}). got {embedding.prompt_index}"
                )
        class_indices: list[int] = [embedding.class_index for embedding in self.embeddings]
        if class_indices != sorted(class_indices) or set(class_indices) != set(range(len(self.class_names))):
            raise ValueError("the vectors must be ordered by class, at least one per class.")

    def prompt_label_of(self, embedding: EmbeddingLogit) -> str | None:
        """
        Label of the prompt of a vector.

        Parameters
        ----------
        embedding : EmbeddingLogit
            One of ``embeddings``.

        Returns
        -------
        str | None
            Phrase or reference image label; ``None`` once the prompts of its class were merged.
        """
        return None if embedding.prompt_index is None else self.prompt_labels[embedding.prompt_index]

    def similarity_of(self, logit: float) -> float:
        """
        Cosine similarity a logit stands for.

        Parameters
        ----------
        logit : float
            Logit of a vector or of an aggregated group of them.

        Returns
        -------
        float
            Similarity before the scale and bias of the classifier.
        """
        return (logit - self.logit_bias) / self.logit_scale
