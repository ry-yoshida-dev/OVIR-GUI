from dataclasses import dataclass


@dataclass(frozen=True)
class PromptSentence:
    """
    One query a classifier scores for a class: a phrase filled into one text template, or a reference image.

    Attributes
    ----------
    class_index : int
        Class of the prompt it belongs to.
    prompt_index : int
        Position of its phrase or reference image in ``LabeledPrompt.prompt_labels``.
    template : str | None
        Text template the phrase was filled into, ``"{}"`` for the phrase as written; ``None`` for a reference image.
    query_index : int
        Query of the library prompt holding its logit; equal sentences share one query.
    """

    class_index: int
    prompt_index: int
    template: str | None
    query_index: int
