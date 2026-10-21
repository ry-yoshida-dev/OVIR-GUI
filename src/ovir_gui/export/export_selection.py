from collections.abc import Mapping
from dataclasses import dataclass, replace

from ..media import FrameKey
from ..recognition import Finding, FrameResult, RecognitionTask
from ..results import StoredResult
from ..review import ReviewFilter


@dataclass(frozen=True)
class ExportSelection:
    """
    Which stored findings of a picture are exported.

    A finding is exported when the user kept it, it passes the review (its minimum and the suppression of duplicates),
    it reaches the minimum of the export, and, when only listed findings are exported, the result table lists it.

    Attributes
    ----------
    review_filter : ReviewFilter
        Minimums and duplicate suppression of the review.
    minimum_confidence : float
        Minimum confidence of the export.
    listed_indices : Mapping[FrameKey, frozenset[int]] | None
        Findings the result table lists per picture; ``None`` exports every kept finding.
    """

    review_filter: ReviewFilter
    minimum_confidence: float = 0.0
    listed_indices: Mapping[FrameKey, frozenset[int]] | None = None

    def exported_indices(self, frame_key: FrameKey, stored: StoredResult) -> tuple[int, ...]:
        """
        Findings of a stored result that are exported.

        Parameters
        ----------
        frame_key : FrameKey
            Picture of the result.
        stored : StoredResult
            Stored result of the picture.

        Returns
        -------
        tuple[int, ...]
            Indices in result order of the findings kept, passing the review, above the export minimum and, if
            required, listed.
        """
        findings: tuple[Finding, ...] = stored.result.findings
        passing: frozenset[int] = self.review_filter.passing_indices(findings)
        listed: frozenset[int] | None = (
            None if self.listed_indices is None else self.listed_indices.get(frame_key, frozenset())
        )
        return tuple(
            finding.index
            for finding in findings
            if stored.is_accepted(finding.index)
            and finding.index in passing
            and finding.confidence >= self.minimum_confidence
            and (listed is None or finding.index in listed)
        )

    def selected(self, frame_key: FrameKey, stored: StoredResult) -> tuple[FrameResult, str | None]:
        """
        Exported part of a stored result.

        Parameters
        ----------
        frame_key : FrameKey
            Picture of the result.
        stored : StoredResult
            Stored result.

        Returns
        -------
        tuple[FrameResult, str | None]
            The result with only the exported instances, and the exported class of a classification (``None`` when
            its top class is not exported).
        """
        result: FrameResult = stored.result
        kept: tuple[int, ...] = self.exported_indices(frame_key, stored)
        if result.task is RecognitionTask.CLASSIFICATION:
            top: Finding = result.findings[0]
            return result, top.class_name if top.index in kept else None
        return replace(result, instances=tuple(result.instances[index] for index in kept)), None
