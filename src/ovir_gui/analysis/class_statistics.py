from dataclasses import dataclass

from .confidence_summary import ConfidenceSummary
from .size_distribution import SizeDistribution
from .threshold_curve import ThresholdCurve


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
        Findings kept by the user but filtered out by the review: below the minimum or suppressed as duplicates.
    kept_count : int
        Findings neither rejected nor filtered out.
    peak_count : int
        Most kept findings of the class in one picture.
    confidences : ConfidenceSummary | None
        Spread of the confidences of every stored finding; ``None`` without findings.
    kept_confidences : ConfidenceSummary | None
        Spread of the confidences of the kept findings; ``None`` without kept findings.
    threshold_curve : ThresholdCurve
        What every minimum confidence would keep of the accepted findings.
    sizes : SizeDistribution | None
        Sizes of the kept findings; ``None`` for classifications, which have no area.
    """

    class_name: str
    picture_count: int
    finding_count: int
    rejected_count: int
    below_minimum_count: int
    kept_count: int
    peak_count: int
    confidences: ConfidenceSummary | None
    kept_confidences: ConfidenceSummary | None
    threshold_curve: ThresholdCurve
    sizes: SizeDistribution | None
