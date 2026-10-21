from pydantic import BaseModel


class SuppressionBody(BaseModel):
    """
    Review suppression of overlapping boxes for the current task.

    Attributes
    ----------
    is_enabled : bool
        Whether duplicates are removed.
    overlap_threshold : float
        Intersection over union above which the lower-scored box of a class is removed.
    class_overlap_thresholds : dict[str, float]
        Own overlap of some classes.
    """

    is_enabled: bool
    overlap_threshold: float
    class_overlap_thresholds: dict[str, float]
