from collections.abc import Mapping
from types import MappingProxyType
from typing import ClassVar


class DuplicateSuppression:
    """
    Class-wise non-maximum suppression applied to stored findings while they are reviewed.

    Detectors often find an object twice with slightly different boxes, also for two phrases of one class; keeping
    only the highest-scored box of each overlapping group gives one box per object. The suppression runs on stored
    results, so its overlap can be tuned per class without recognizing again.
    """

    DEFAULT_OVERLAP_THRESHOLD: ClassVar[float] = 0.5

    def __init__(
        self,
        is_enabled: bool = False,
        overlap_threshold: float = DEFAULT_OVERLAP_THRESHOLD,
        class_overlap_thresholds: Mapping[str, float] | None = None,
    ) -> None:
        """
        Parameters
        ----------
        is_enabled : bool, optional
            Whether duplicates are removed.
        overlap_threshold : float, optional
            Intersection over union in ``[0, 1]`` above which the lower-scored box of a class is removed.
        class_overlap_thresholds : Mapping[str, float] | None, optional
            Own overlap of some classes, in ``[0, 1]``; ``None`` sets none.

        Raises
        ------
        ValueError
            If an overlap is outside ``[0, 1]`` or a class name is blank.
        """
        overlaps: dict[str, float] = dict(class_overlap_thresholds or {})
        for name, overlap in (("default", overlap_threshold), *overlaps.items()):
            if not 0.0 <= overlap <= 1.0:
                raise ValueError(f"overlap threshold of {name} must be in [0, 1]. got {overlap}")
        if any(not class_name.strip() for class_name in overlaps):
            raise ValueError(f"class names must not be blank. got {list(overlaps)}")
        self._is_enabled: bool = is_enabled
        self._overlap_threshold: float = overlap_threshold
        self._class_overlap_thresholds: MappingProxyType[str, float] = MappingProxyType(overlaps)

    def __eq__(self, other: object) -> bool:
        return (
            isinstance(other, DuplicateSuppression)
            and self._is_enabled == other._is_enabled
            and self._overlap_threshold == other._overlap_threshold
            and dict(self._class_overlap_thresholds) == dict(other._class_overlap_thresholds)
        )

    def __hash__(self) -> int:
        return hash((self._is_enabled, self._overlap_threshold, frozenset(self._class_overlap_thresholds.items())))

    def __repr__(self) -> str:
        return (
            f"{self.__class__.__name__}(is_enabled={self._is_enabled}, "
            + f"overlap_threshold={self._overlap_threshold}, {dict(self._class_overlap_thresholds)})"
        )

    @property
    def is_enabled(self) -> bool:
        """
        Whether duplicates are removed.

        Returns
        -------
        bool
            True when the suppression runs.
        """
        return self._is_enabled

    @property
    def overlap_threshold(self) -> float:
        """
        Overlap of every class without its own.

        Returns
        -------
        float
            Intersection over union in ``[0, 1]``.
        """
        return self._overlap_threshold

    @property
    def class_overlap_thresholds(self) -> Mapping[str, float]:
        """
        Classes with their own overlap.

        Returns
        -------
        Mapping[str, float]
            Read-only view of the overlap of each such class.
        """
        return self._class_overlap_thresholds

    def overlap_threshold_of(self, class_name: str) -> float:
        """
        Overlap above which the lower-scored of two boxes of a class is removed.

        Parameters
        ----------
        class_name : str
            Class to look up.

        Returns
        -------
        float
            Its own overlap, or the default one.
        """
        return self._class_overlap_thresholds.get(class_name, self._overlap_threshold)
