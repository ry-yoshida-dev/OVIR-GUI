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
    EXEMPLAR : str
        Positive and negative boxes drawn on the picture being segmented, defining the class there (SAM 3).
    MARK : str
        Points and a box drawn on the picture, each marking one object of a class (SAM, SAM 2, video trackers).
    """

    TEXT = "text"
    VISUAL = "visual"
    EXEMPLAR = "exemplar"
    MARK = "mark"

    @property
    def is_drawn_on_picture(self) -> bool:
        """
        Whether the query is drawn on the recognized picture itself rather than given per class.

        Returns
        -------
        bool
            True for exemplar boxes and object marks.
        """
        match self:
            case QueryKind.TEXT | QueryKind.VISUAL:
                return False
            case QueryKind.EXEMPLAR | QueryKind.MARK:
                return True
