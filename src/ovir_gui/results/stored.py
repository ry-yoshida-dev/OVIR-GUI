from dataclasses import dataclass, replace

from ..prompting import PromptSignature
from ..recognition import FrameResult
from ..review import ReviewFilter


@dataclass(frozen=True, eq=False)
class StoredResult:
    """
    Latest result of one picture with what it was recognized with and the findings the user rejected.

    Attributes
    ----------
    result : FrameResult
        What the model recognized.
    signature : PromptSignature
        What the classes queried, narrowed to the query kinds of the model.
    rejected_indices : frozenset[int]
        Findings the user rejected; they stay stored but are left out of exports and statistics of kept findings.
    """

    result: FrameResult
    signature: PromptSignature
    rejected_indices: frozenset[int] = frozenset()

    def is_accepted(self, index: int) -> bool:
        """
        Whether a finding is kept.

        Parameters
        ----------
        index : int
            Finding of the result.

        Returns
        -------
        bool
            False once the user rejected it.
        """
        return index not in self.rejected_indices

    def kept_indices(self, review_filter: ReviewFilter) -> frozenset[int]:
        """
        Findings kept in the review: listed in its label mode, accepted by the user and passing the review filter.

        Parameters
        ----------
        review_filter : ReviewFilter
            Label mode, minimums and duplicate suppression of the review.

        Returns
        -------
        frozenset[int]
            Indices of the kept findings.
        """
        return frozenset(index for index in review_filter.passing_indices_of(self.result) if self.is_accepted(index))

    def with_accepted(self, indices: frozenset[int], is_accepted: bool) -> "StoredResult":
        """
        Same result with some findings kept or rejected.

        Parameters
        ----------
        indices : frozenset[int]
            Findings to change, by the position of their class score or instance.
        is_accepted : bool
            True to keep them, False to reject them.

        Returns
        -------
        StoredResult
            Copy with the rejections updated.

        Raises
        ------
        IndexError
            If an index is outside the class scores or instances of the result.
        """
        finding_count: int = self.result.candidate_count
        if any(not 0 <= index < finding_count for index in indices):
            raise IndexError(f"finding indices must be in [0, {finding_count}). got {sorted(indices)}")
        rejected: frozenset[int] = self.rejected_indices - indices if is_accepted else self.rejected_indices | indices
        return replace(self, rejected_indices=rejected)
