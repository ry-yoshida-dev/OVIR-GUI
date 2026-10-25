from dataclasses import dataclass


@dataclass(frozen=True)
class ClassComparison:
    """
    Kept findings of one class by the shown and the compared model on the pictures both recognized.

    Attributes
    ----------
    class_name : str
        Class.
    shown_count : int
        Kept findings of the shown model.
    compared_count : int
        Kept findings of the compared model.
    matched_count : int
        Findings both models agree on: overlapping instances, or pictures both classify as the class.
    mean_matched_overlap : float | None
        Mean intersection over union of the matched instances; ``None`` for classifications or without matches.
    """

    class_name: str
    shown_count: int
    compared_count: int
    matched_count: int
    mean_matched_overlap: float | None

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

    @property
    def agreement(self) -> float | None:
        """
        Matched findings over the findings of either model, as the intersection over union of the two sets.

        Returns
        -------
        float | None
            Share in ``[0, 1]``; ``None`` when neither model has a finding.
        """
        union_count: int = self.shown_count + self.compared_count - self.matched_count
        return None if union_count == 0 else self.matched_count / union_count
