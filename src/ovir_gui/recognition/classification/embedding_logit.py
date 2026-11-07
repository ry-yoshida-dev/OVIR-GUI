from dataclasses import dataclass


@dataclass(frozen=True)
class EmbeddingLogit:
    """
    Logit a classifier gave one text vector of a class: a phrase filled into one text template, a reference image, or
    a group of them merged by the aggregation steps on text vectors.

    Attributes
    ----------
    class_index : int
        Class the vector belongs to.
    prompt_index : int | None
        Position of its phrase or reference image in ``ClassifierLogits.prompt_labels``; ``None`` once the prompts of
        its class were merged.
    template : str | None
        Text template the phrase was filled into, ``"{}"`` for the phrase as written; ``None`` for a reference image
        and once the templates were merged.
    logit : float
        Logit of the vector for the picture.
    """

    class_index: int
    prompt_index: int | None
    template: str | None
    logit: float
