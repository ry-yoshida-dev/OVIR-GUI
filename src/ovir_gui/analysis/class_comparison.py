from dataclasses import dataclass


@dataclass(frozen=True)
class ClassComparison:
    """
    Findings of one class by the shown and the compared model on the pictures both recognized.

    Attributes
    ----------
    class_name : str
        Class.
    shown_count : int
        Findings of the shown model.
    compared_count : int
        Findings of the compared model.
    matched_count : int
        Findings both models agree on: overlapping instances, or pictures both classify as the class.
    """

    class_name: str
    shown_count: int
    compared_count: int
    matched_count: int

    @property
    def shown_only_count(self) -> int:
        """
        Findings only the shown model has.

        Returns
        -------
        int
            Shown minus matched.
        """
        return self.shown_count - self.matched_count

    @property
    def compared_only_count(self) -> int:
        """
        Findings only the compared model has.

        Returns
        -------
        int
            Compared minus matched.
        """
        return self.compared_count - self.matched_count
