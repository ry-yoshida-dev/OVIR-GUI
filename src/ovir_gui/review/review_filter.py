from collections.abc import Sequence

from ..recognition import Finding, FrameResult, LabelMode, PixelBox
from .class_thresholds import ClassThresholds
from .duplicate_suppression import DuplicateSuppression
from .label_mode_choice import LabelModeChoice


class ReviewFilter:
    """
    Which stored findings pass the review: among the findings the label mode lists, those reaching the minimum of
    their phrase, then without the duplicates the suppression removes.

    Rejected findings suppress like kept ones, so rejecting a box never brings back the boxes it hid. Results are
    stored before every step, so changing the label mode, the minimums or the suppression needs no new recognition.
    """

    def __init__(
        self,
        thresholds: ClassThresholds,
        suppression: DuplicateSuppression,
        label_mode: LabelModeChoice = LabelModeChoice.AUTOMATIC,
    ) -> None:
        """
        Parameters
        ----------
        thresholds : ClassThresholds
            Minimum confidences.
        suppression : DuplicateSuppression
            Removal of overlapping boxes of one class.
        label_mode : LabelModeChoice, optional
            How many classes a classified picture may keep.
        """
        self._thresholds: ClassThresholds = thresholds
        self._suppression: DuplicateSuppression = suppression
        self._label_mode: LabelModeChoice = label_mode

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

    @property
    def label_mode(self) -> LabelModeChoice:
        """
        Label mode chosen for classifications.

        Returns
        -------
        LabelModeChoice
            Chosen mode, possibly automatic.
        """
        return self._label_mode

    def label_mode_of(self, result: FrameResult) -> LabelMode:
        """
        Label mode applied to one result.

        Parameters
        ----------
        result : FrameResult
            Stored result.

        Returns
        -------
        LabelMode
            Chosen mode, or the native mode of the result when automatic.
        """
        return self._label_mode.resolved(result.native_label_mode)

    def findings_of(self, result: FrameResult) -> tuple[Finding, ...]:
        """
        Findings of a result the review lists.

        Parameters
        ----------
        result : FrameResult
            Stored result.

        Returns
        -------
        tuple[Finding, ...]
            The best class or every class of a classification, or every instance.
        """
        return result.findings_of(self.label_mode_of(result))

    def passing_indices_of(self, result: FrameResult) -> frozenset[int]:
        """
        Listed findings of a result passing the review.

        Parameters
        ----------
        result : FrameResult
            Stored result.

        Returns
        -------
        frozenset[int]
            Indices of the listed findings reaching their minimum and not removed as duplicates.
        """
        return self.passing_indices(self.findings_of(result))

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
