from collections.abc import Mapping
from dataclasses import dataclass, replace

from ..media import FrameKey
from ..recognition import FrameResult, RecognitionTask
from ..results import StoredResult
from ..review import ReviewFilter
from .export_item import ExportItem


@dataclass(frozen=True)
class ExportSelection:
    """
    Which stored findings of a picture are exported.

    A finding is exported when the user kept it, it passes the review (its minimum and the suppression of duplicates)
    and, when the result table restricts the export, the table lists it.

    Attributes
    ----------
    review_filter : ReviewFilter
        Label mode, minimums and duplicate suppression of the review.
    listed_indices : Mapping[FrameKey, frozenset[int]] | None
        Findings the result table lists per picture; ``None`` exports every kept finding.
    """

    review_filter: ReviewFilter
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
            Indices in listing order of the findings kept, passing the review and, if required, listed.
        """
        kept: frozenset[int] = stored.kept_indices(self.review_filter)
        listed: frozenset[int] | None = (
            None if self.listed_indices is None else self.listed_indices.get(frame_key, frozenset())
        )
        return tuple(
            finding.index
            for finding in self.review_filter.findings_of(stored.result)
            if finding.index in kept and (listed is None or finding.index in listed)
        )

    def item_of(self, frame_key: FrameKey, stored: StoredResult, seconds: float | None) -> ExportItem:
        """
        Exported part of a stored result.

        Parameters
        ----------
        frame_key : FrameKey
            Picture of the result.
        stored : StoredResult
            Stored result.
        seconds : float | None
            Time of the picture in its video; ``None`` for an image.

        Returns
        -------
        ExportItem
            The result with only the exported instances, labelled with the exported classes of a classification.
        """
        result: FrameResult = stored.result
        kept: tuple[int, ...] = self.exported_indices(frame_key, stored)
        if result.task is RecognitionTask.CLASSIFICATION:
            labels: tuple[str, ...] = tuple(result.class_scores[index].class_name for index in kept)
            return ExportItem(frame_key=frame_key, result=result, labels=labels, seconds=seconds)
        return ExportItem(
            frame_key=frame_key,
            result=replace(result, instances=tuple(result.instances[index] for index in kept)),
            labels=(),
            seconds=seconds,
        )
