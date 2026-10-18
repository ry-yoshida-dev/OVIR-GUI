from collections.abc import Mapping
from dataclasses import dataclass, replace

from ..media import FrameKey
from ..recognition import Finding, FrameResult, RecognitionTask
from ..results import StoredResult
from ..review import ClassThresholds


@dataclass(frozen=True)
class ExportSelection:
    """
    Which stored findings of a picture are exported.

    A finding is exported when the user kept it, it reaches the minimum of its class and of the export, and, when
    only listed findings are exported, the result table lists it.

    Attributes
    ----------
    class_thresholds : ClassThresholds
        Minimum confidence of each class.
    minimum_confidence : float
        Minimum confidence of the export.
    listed_indices : Mapping[FrameKey, frozenset[int]] | None
        Findings the result table lists per picture; ``None`` exports every kept finding.
    """

    class_thresholds: ClassThresholds
    minimum_confidence: float = 0.0
    listed_indices: Mapping[FrameKey, frozenset[int]] | None = None

    def is_exported(self, frame_key: FrameKey, stored: StoredResult, finding: Finding) -> bool:
        """
        Whether one finding is exported.

        Parameters
        ----------
        frame_key : FrameKey
            Picture of the finding.
        stored : StoredResult
            Stored result of the picture.
        finding : Finding
            Finding of the result.

        Returns
        -------
        bool
            True when kept, above the minimums and, if required, listed.
        """
        if not stored.is_accepted(finding.index):
            return False
        if finding.confidence < self.minimum_confidence:
            return False
        if not self.class_thresholds.accepts(finding.class_name, finding.confidence):
            return False
        if self.listed_indices is not None:
            return finding.index in self.listed_indices.get(frame_key, frozenset())
        return True

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
        if result.task is RecognitionTask.CLASSIFICATION:
            top: Finding = result.findings[0]
            return result, top.class_name if self.is_exported(frame_key, stored, top) else None
        kept: tuple[int, ...] = tuple(
            finding.index for finding in result.findings if self.is_exported(frame_key, stored, finding)
        )
        return replace(result, instances=tuple(result.instances[index] for index in kept)), None
