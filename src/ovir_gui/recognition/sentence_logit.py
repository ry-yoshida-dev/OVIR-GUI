from dataclasses import dataclass


@dataclass(frozen=True)
class SentenceLogit:
    """
    Logit a classifier gave one sentence of a class: a phrase filled into one text template, or a reference image.

    Attributes
    ----------
    class_index : int
        Class of the prompt it belongs to.
    prompt_index : int
        Position of its phrase or reference image in ``ClassifierLogits.prompt_labels``.
    template : str | None
        Text template the phrase was filled into, ``"{}"`` for the phrase as written; ``None`` for a reference image.
    logit : float
        Logit of the sentence for the picture.
    """

    class_index: int
    prompt_index: int
    template: str | None
    logit: float
