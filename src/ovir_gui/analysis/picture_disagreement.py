from dataclasses import dataclass

from ..media import FrameKey


@dataclass(frozen=True)
class PictureDisagreement:
    """
    Kept findings of the shown and the compared model on one picture both recognized.

    Attributes
    ----------
    frame_key : FrameKey
        Picture.
    shown_count : int
        Kept findings of the shown model.
    compared_count : int
        Kept findings of the compared model.
    matched_count : int
        Findings both models agree on.
    """

    frame_key: FrameKey
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

    @property
    def unmatched_count(self) -> int:
        """
        Findings only one of the models has.

        Returns
        -------
        int
            Shown-only plus compared-only.
        """
        return self.shown_only_count + self.compared_only_count
