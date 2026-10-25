from dataclasses import dataclass

from ..media import FrameKey


@dataclass(frozen=True)
class PictureStatistics:
    """
    Findings of one recognized picture.

    Attributes
    ----------
    frame_key : FrameKey
        Picture.
    finding_count : int
        Every stored finding.
    kept_count : int
        Findings kept in the review.
    kept_class_names : tuple[str, ...]
        Classes of the kept findings, most findings first.
    best_confidence : float | None
        Highest confidence of an accepted finding, kept or not; ``None`` without one.
    borderline_count : int
        Accepted findings whose confidence lies within ``ResultStatistics.BORDERLINE_MARGIN`` of the minimum of their
        phrase, on either side, so a small change of the minimum keeps or drops them.
    top_margin : float | None
        Score of the top class minus the score of the runner-up of a classification; ``None`` otherwise.
    """

    frame_key: FrameKey
    finding_count: int
    kept_count: int
    kept_class_names: tuple[str, ...]
    best_confidence: float | None
    borderline_count: int
    top_margin: float | None
