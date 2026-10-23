from collections.abc import Sequence

from ..recognition import Finding, PixelBox
from .class_thresholds import ClassThresholds
from .duplicate_suppression import DuplicateSuppression


class ReviewFilter:
    """
    Which stored findings pass the review: those reaching the minimum of their phrase, then without the duplicates
    the suppression removes.

    Rejected findings suppress like kept ones, so rejecting a box never brings back the boxes it hid. Results are
    stored before both steps, so changing the minimums or the suppression needs no new recognition.
    """

    def __init__(self, thresholds: ClassThresholds, suppression: DuplicateSuppression) -> None:
        """
        Parameters
        ----------
        thresholds : ClassThresholds
            Minimum confidences.
        suppression : DuplicateSuppression
            Removal of overlapping boxes of one class.
        """
        self._thresholds: ClassThresholds = thresholds
        self._suppression: DuplicateSuppression = suppression

    @property
    def thresholds(self) -> ClassThresholds:
        """
        Minimum confidences applied first.

        Returns
        -------
        ClassThresholds
            Default, class and phrase minimums.
        """
        return self._thresholds

    @property
    def suppression(self) -> DuplicateSuppression:
        """
        Suppression applied to the findings reaching their minimum.

        Returns
        -------
        DuplicateSuppression
            Overlaps and whether the suppression runs.
        """
        return self._suppression

    def reaching_indices(self, findings: Sequence[Finding]) -> frozenset[int]:
        """
        Findings reaching the minimum of their phrase, before the suppression.

        Parameters
        ----------
        findings : Sequence[Finding]
            Findings of one result.

        Returns
        -------
        frozenset[int]
            Indices of the findings reaching their minimum.
        """
        return frozenset(
            finding.index
            for finding in findings
            if self._thresholds.is_reaching_minimum(finding.class_name, finding.query_label, finding.confidence)
        )

    def passing_indices(self, findings: Sequence[Finding]) -> frozenset[int]:
        """
        Findings passing the review.

        Parameters
        ----------
        findings : Sequence[Finding]
            Findings of one result.

        Returns
        -------
        frozenset[int]
            Indices of the findings reaching their minimum and not removed as duplicates.
        """
        reaching: frozenset[int] = self.reaching_indices(findings)
        if not self._suppression.is_enabled:
            return reaching
        candidates: list[Finding] = sorted(
            (finding for finding in findings if finding.index in reaching),
            key=lambda finding: (-finding.confidence, finding.index),
        )
        kept: list[tuple[str, PixelBox]] = []
        passing: set[int] = set()
        for finding in candidates:
            if finding.box is None:
                passing.add(finding.index)
                continue
            overlap: float = self._suppression.overlap_threshold_of(finding.class_name)
            box: PixelBox = finding.box
            is_duplicate: bool = any(
                class_name == finding.class_name and kept_box.intersection_over_union(box) > overlap
                for class_name, kept_box in kept
            )
            if not is_duplicate:
                kept.append((finding.class_name, box))
                passing.add(finding.index)
        return frozenset(passing)
