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
        Logit of the best prompt of the class.
    matched_prompt : str
        Prompt that scored highest: a phrase or a reference image name.
    similarity : float | None
        Cosine similarity in ``[-1, 1]`` of the image and the best prompt of the class; ``None`` for results stored
        before it was recorded.
    matched_template : str | None
        Text template of the best sentence of the matched prompt, ``"{}"`` for the phrase as written; ``None`` for a
        reference image or results stored before it was recorded.
    """

    class_name: str
    score: float
    logit: float
    matched_prompt: str
    similarity: float | None
    matched_template: str | None
