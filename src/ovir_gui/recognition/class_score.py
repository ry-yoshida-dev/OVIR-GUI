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
        Logit of the best query of the class.
    query_label : str
        Label of the query that scored highest: a phrase or a reference image name.
    """

    class_name: str
    score: float
    logit: float
    query_label: str
