import statistics
from collections.abc import Sequence
from dataclasses import dataclass


@dataclass(frozen=True)
class ConfidenceSummary:
    """
    Spread of some confidences in quantiles.

    Attributes
    ----------
    count : int
        Confidences summarized.
    minimum : float
        Lowest confidence.
    lower_decile : float
        10th percentile.
    lower_quartile : float
        25th percentile.
    median : float
        50th percentile.
    upper_quartile : float
        75th percentile.
    upper_decile : float
        90th percentile.
    maximum : float
        Highest confidence.
    mean : float
        Arithmetic mean.
    """

    count: int
    minimum: float
    lower_decile: float
    lower_quartile: float
    median: float
    upper_quartile: float
    upper_decile: float
    maximum: float
    mean: float

    @classmethod
    def of(cls, confidences: Sequence[float]) -> "ConfidenceSummary | None":
        """
        Summarize confidences, interpolating quantiles between the closest values.

        Parameters
        ----------
        confidences : Sequence[float]
            Confidences in any order.

        Returns
        -------
        ConfidenceSummary | None
            ``None`` without confidences.
        """
        if not confidences:
            return None
        ordered: list[float] = sorted(confidences)
        return cls(
            count=len(ordered),
            minimum=ordered[0],
            lower_decile=cls._quantile(ordered, 0.1),
            lower_quartile=cls._quantile(ordered, 0.25),
            median=cls._quantile(ordered, 0.5),
            upper_quartile=cls._quantile(ordered, 0.75),
            upper_decile=cls._quantile(ordered, 0.9),
            maximum=ordered[-1],
            mean=statistics.fmean(ordered),
        )

    @staticmethod
    def _quantile(ordered: Sequence[float], fraction: float) -> float:
        position: float = fraction * (len(ordered) - 1)
        lower: int = int(position)
        upper: int = min(lower + 1, len(ordered) - 1)
        return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)
