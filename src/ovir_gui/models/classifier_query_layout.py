from dataclasses import dataclass

from open_vocabulary_classification import ClassificationResult, EmbeddingEntry, Prompt

from ..prompting import LabeledPrompt
from ..recognition import ClassifierLogits, EmbeddingLogit


@dataclass(frozen=True)
class ClassifierQueryLayout:
    """
    Library prompt of a classifier with the prompt label of every query.

    Attributes
    ----------
    prompt : Prompt
        Library prompt: the classes with their phrases and visual queries.
    query_prompt_indices : tuple[int, ...]
        Position in ``LabeledPrompt.prompt_labels`` of every query of ``prompt``, in query-id order.

    Raises
    ------
    ValueError
        If there is not one prompt index per query.
    """

    prompt: Prompt
    query_prompt_indices: tuple[int, ...]

    def __post_init__(self) -> None:
        if len(self.query_prompt_indices) != len(self.prompt.queries):
            raise ValueError(
                f"query_prompt_indices must hold one index per query ({len(self.prompt.queries)}). "
                + f"got {len(self.query_prompt_indices)}"
            )

    def logits_of(
        self, result: ClassificationResult, labeled_prompt: LabeledPrompt, logit_scale: float, logit_bias: float
    ) -> ClassifierLogits:
        """
        Logit of every text vector of one picture.

        Parameters
        ----------
        result : ClassificationResult
            Result of the library for the picture.
        labeled_prompt : LabeledPrompt
            Prompt the layout was built from, naming the classes and the prompts.
        logit_scale : float
            Scale of the classifier turning a cosine similarity into a logit.
        logit_bias : float
            Bias of the classifier turning a cosine similarity into a logit.

        Returns
        -------
        ClassifierLogits
            Text vectors of the classes with their logits.
        """
        return ClassifierLogits(
            class_names=labeled_prompt.class_names,
            prompt_labels=labeled_prompt.prompt_labels,
            embeddings=tuple(
                self._embedding_logit_of(entry, float(logit))
                for entry, logit in zip(result.layout.entries, result.embedding_logits.tolist(), strict=True)
            ),
            logit_scale=logit_scale,
            logit_bias=logit_bias,
        )

    def _embedding_logit_of(self, entry: EmbeddingEntry, logit: float) -> EmbeddingLogit:
        return EmbeddingLogit(
            class_index=entry.class_id,
            prompt_index=None if entry.query_id is None else self.query_prompt_indices[entry.query_id],
            template=entry.template,
            logit=logit,
        )
