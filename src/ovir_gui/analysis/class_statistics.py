import statistics
from dataclasses import dataclass

from .confidence_histogram import ConfidenceHistogram


@dataclass(frozen=True)
class ClassStatistics:
    """
    Findings of one class over some pictures.

    Attributes
    ----------
    class_name : str
        Class.
    picture_count : int
        Pictures with at least one kept finding of the class.
    finding_count : int
        Every stored finding of the class.
    rejected_count : int
        Findings the user rejected.
    below_minimum_count : int
        Findings kept by the user but below the minimum confidence of the class.
    kept_count : int
        Findings neither rejected nor below the minimum.
    confidences : tuple[float, ...]
        Confidence of every stored finding.
    """

    class_name: str
    picture_count: int
    finding_count: int
    rejected_count: int
    below_minimum_count: int
    kept_count: int
    confidences: tuple[float, ...]

    @property
    def mean_confidence(self) -> float | None:
        """
        Mean confidence.

        Returns
        -------
        float | None
            ``None`` without findings.
        """
        return statistics.fmean(self.confidences) if self.confidences else None

    @property
    def median_confidence(self) -> float | None:
        """
        Median confidence.

        Returns
        -------
        float | None
            ``None`` without findings.
        """
        return statistics.median(self.confidences) if self.confidences else None

    @property
    def histogram(self) -> ConfidenceHistogram:
        """
        Confidences in equal-width bins.

        Returns
        -------
        ConfidenceHistogram
            Histogram of every stored finding.
        """
        return ConfidenceHistogram.of(self.confidences)
