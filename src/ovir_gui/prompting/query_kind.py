from enum import Enum


class QueryKind(Enum):
    """
    How a query tells the model what a class looks like.

    Attributes
    ----------
    TEXT : str
        A phrase.
    VISUAL : str
        Reference images with boxes around examples of the class.
    """

    TEXT = "text"
    VISUAL = "visual"
