import statistics
from collections.abc import Sequence
from dataclasses import dataclass

from .size_band import SizeBand


@dataclass(frozen=True)
class SizeDistribution:
    """
    Sizes of the kept findings of one class.

    Attributes
    ----------
    small_count : int
        Findings in ``SizeBand.SMALL``.
    medium_count : int
        Findings in ``SizeBand.MEDIUM``.
    large_count : int
        Findings in ``SizeBand.LARGE``.
    median_area_share : float | None
        Median share of its picture a finding covers, in ``[0, 1]``; ``None`` without findings.
    """

    small_count: int
    medium_count: int
    large_count: int
    median_area_share: float | None

    @classmethod
    def of(cls, areas: Sequence[float], area_shares: Sequence[float]) -> "SizeDistribution":
        """
        Count findings per band.

        Parameters
        ----------
        areas : Sequence[float]
            Pixel areas of the findings.
        area_shares : Sequence[float]
            Share of its picture each finding covers.

        Returns
        -------
        SizeDistribution
            Counts per band and the median share.
        """
        bands: list[SizeBand] = [SizeBand.of_area(area) for area in areas]
        return cls(
            small_count=bands.count(SizeBand.SMALL),
            medium_count=bands.count(SizeBand.MEDIUM),
            large_count=bands.count(SizeBand.LARGE),
            median_area_share=statistics.median(area_shares) if area_shares else None,
        )
