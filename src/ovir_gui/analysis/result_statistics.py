from collections.abc import Sequence
from dataclasses import dataclass

from ..media import FrameKey
from ..recognition import Finding
from ..results import ResultCatalog, StoredResult
from ..review import ClassThresholds
from .class_statistics import ClassStatistics
from .confidence_histogram import ConfidenceHistogram


@dataclass(frozen=True)
class ResultStatistics:
    """
    Per-class statistics of the findings of one profile over some pictures.

    Attributes
    ----------
    picture_count : int
        Pictures considered.
    recognized_count : int
        Considered pictures with a result.
    classes : tuple[ClassStatistics, ...]
        Statistics of the current classes in class order, followed by classes only older results report.
    """

    picture_count: int
    recognized_count: int
    classes: tuple[ClassStatistics, ...]

    @classmethod
    def of(
        cls,
        catalog: ResultCatalog,
        frame_keys: Sequence[FrameKey],
        class_names: Sequence[str],
        thresholds: ClassThresholds,
    ) -> "ResultStatistics":
        """
        Count the findings of some pictures.

        Parameters
        ----------
        catalog : ResultCatalog
            Results of the profile.
        frame_keys : Sequence[FrameKey]
            Pictures to consider.
        class_names : Sequence[str]
            Current classes, listed first even without findings.
        thresholds : ClassThresholds
            Minimum confidence of each class.

        Returns
        -------
        ResultStatistics
            Counts and confidences per class.
        """
        names: list[str] = list(class_names)
        confidences: dict[str, list[float]] = {name: [] for name in names}
        rejected: dict[str, int] = {name: 0 for name in names}
        below: dict[str, int] = {name: 0 for name in names}
        pictures: dict[str, int] = {name: 0 for name in names}
        recognized_count: int = 0
        for frame_key in frame_keys:
            stored: StoredResult | None = catalog.stored_of(frame_key)
            if stored is None:
                continue
            recognized_count += 1
            kept_classes: set[str] = set()
            finding: Finding
            for finding in stored.result.findings:
                if finding.class_name not in confidences:
                    names.append(finding.class_name)
                    confidences[finding.class_name] = []
                    rejected[finding.class_name] = 0
                    below[finding.class_name] = 0
                    pictures[finding.class_name] = 0
                confidences[finding.class_name].append(finding.confidence)
                if not stored.is_accepted(finding.index):
                    rejected[finding.class_name] += 1
                elif not thresholds.accepts(finding.class_name, finding.confidence):
                    below[finding.class_name] += 1
                else:
                    kept_classes.add(finding.class_name)
            for class_name in kept_classes:
                pictures[class_name] += 1
        return cls(
            picture_count=len(frame_keys),
            recognized_count=recognized_count,
            classes=tuple(
                ClassStatistics(
                    class_name=name,
                    picture_count=pictures[name],
                    finding_count=len(confidences[name]),
                    rejected_count=rejected[name],
                    below_minimum_count=below[name],
                    kept_count=len(confidences[name]) - rejected[name] - below[name],
                    confidences=tuple(confidences[name]),
                )
                for name in names
            ),
        )

    @property
    def histogram(self) -> ConfidenceHistogram:
        """
        Confidences of every finding of every class.

        Returns
        -------
        ConfidenceHistogram
            Histogram over all classes.
        """
        return ConfidenceHistogram.of(
            confidence for class_statistics in self.classes for confidence in class_statistics.confidences
        )
