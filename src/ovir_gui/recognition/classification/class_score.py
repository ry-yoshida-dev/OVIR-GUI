from dataclasses import dataclass


@dataclass(frozen=True)
class ClassScore:
    """
    Score of one class for a whole image, as a classifier reports it.

    Attributes
    ----------
    class_name : str
        Class of the prompt.
    score : float
        Score in ``[0, 1]``: a share of the classes for softmax models, an independent probability for sigmoid models.
    logit : float
        Logit of the class after the aggregation steps.
    matched_prompt : str | None
        Prompt of the text vector that scored highest among those the logit came from: a phrase or a reference image
        name; ``None`` once the prompts of the class were merged into one text vector.
    similarity : float | None
        Cosine similarity in ``[-1, 1]`` the logit stands for; ``None`` for results stored before it was recorded.
    matched_template : str | None
        Text template of the text vector that scored highest, ``"{}"`` for the phrase as written; ``None`` for a
        reference image, once the templates were merged into one text vector, or for results stored before it was
        recorded.
    """

    class_name: str
    score: float
    logit: float
    matched_prompt: str | None
    similarity: float | None
    matched_template: str | None
