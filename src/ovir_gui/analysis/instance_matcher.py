from collections.abc import Sequence
from typing import ClassVar

from ..recognition import RecognizedInstance


class InstanceMatcher:
    """
    One-to-one pairing of the instances two models found in one picture, by overlap.

    Masks are compared pixel by pixel when both instances have one, boxes otherwise. Pairs are formed greedily from the
    most overlapping one; each instance joins at most one pair, and only pairs whose intersection over union reaches
    the threshold are formed.
    """

    DEFAULT_IOU_THRESHOLD: ClassVar[float] = 0.5

    def __init__(self, iou_threshold: float = DEFAULT_IOU_THRESHOLD) -> None:
        """
        Parameters
        ----------
        iou_threshold : float, optional
            Smallest intersection over union of a pair, in ``(0, 1]``.

        Raises
        ------
        ValueError
            If ``iou_threshold`` is outside ``(0, 1]``.
        """
        if not 0.0 < iou_threshold <= 1.0:
            raise ValueError(f"iou_threshold must be in (0, 1]. got {iou_threshold}")
        self._iou_threshold: float = iou_threshold

    @property
    def iou_threshold(self) -> float:
        """
        Smallest intersection over union of a pair.

        Returns
        -------
        float
            Threshold given at construction.
        """
        return self._iou_threshold

    def pairs(
        self, first: Sequence[RecognizedInstance], second: Sequence[RecognizedInstance]
    ) -> tuple[tuple[int, int], ...]:
        """
        Pair the instances of two sets.

        Parameters
        ----------
        first : Sequence[RecognizedInstance]
            Instances of one model.
        second : Sequence[RecognizedInstance]
            Instances of the other model.

        Returns
        -------
        tuple[tuple[int, int], ...]
            ``(first index, second index)`` of every pair, most overlapping first.
        """
        candidates: list[tuple[float, int, int]] = []
        for first_index, first_instance in enumerate(first):
            for second_index, second_instance in enumerate(second):
                overlap: float = self.overlap(first_instance, second_instance)
                if overlap >= self._iou_threshold:
                    candidates.append((overlap, first_index, second_index))
        candidates.sort(key=lambda candidate: -candidate[0])
        used_first: set[int] = set()
        used_second: set[int] = set()
        pairs: list[tuple[int, int]] = []
        for _, first_index, second_index in candidates:
            if first_index in used_first or second_index in used_second:
                continue
            used_first.add(first_index)
            used_second.add(second_index)
            pairs.append((first_index, second_index))
        return tuple(pairs)

    @staticmethod
    def overlap(first: RecognizedInstance, second: RecognizedInstance) -> float:
        """
        Intersection over union of two instances.

        Parameters
        ----------
        first : RecognizedInstance
            One instance.
        second : RecognizedInstance
            Other instance.

        Returns
        -------
        float
            Mask IoU when both have masks, box IoU otherwise.
        """
        if first.box.intersection_over_union(second.box) == 0.0:
            return 0.0
        if first.mask is not None and second.mask is not None:
            return first.mask.intersection_over_union(second.mask)
        return first.box.intersection_over_union(second.box)
