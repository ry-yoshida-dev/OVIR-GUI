from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from typing import ClassVar

from ..media import FrameKey
from ..recognition import ClassScore, Finding, RecognitionTask, RecognizedInstance
from ..results import ResultCatalog, StoredResult
from ..review import ReviewFilter
from .class_matrix import ClassMatrix
from .class_statistics import ClassStatistics
from .confidence_histogram import ConfidenceHistogram
from .confidence_summary import ConfidenceSummary
from .instance_matcher import InstanceMatcher
from .picture_statistics import PictureStatistics
from .size_distribution import SizeDistribution
from .threshold_curve import ThresholdCurve


@dataclass(frozen=True)
class ResultStatistics:
    """
    Statistics of the findings of one profile over some pictures: per class, per picture, and how classes relate.

    Attributes
    ----------
    picture_count : int
        Pictures considered.
    recognized_count : int
        Considered pictures with a result.
    task : RecognitionTask
        Task of the profile.
    classes : tuple[ClassStatistics, ...]
        Statistics of the current classes in class order, followed by classes only older results report.
    pictures : tuple[PictureStatistics, ...]
        Statistics of every recognized picture in the order considered.
    co_occurrence : ClassMatrix
        Pictures with kept findings of both classes; the diagonal counts pictures with the class at all.
    overlaps : ClassMatrix | None
        Pairs of kept findings of two different classes overlapping by at least ``OVERLAP_THRESHOLD`` on one picture,
        hinting at phrases that describe the same objects; ``None`` for classifications.
    runner_ups : ClassMatrix | None
        Pictures per top class (row) and second-best class (column) of a classification; ``None`` otherwise.
    margins : ConfidenceHistogram | None
        Top score minus runner-up score of every classified picture; ``None`` otherwise.
    """

    OVERLAP_THRESHOLD: ClassVar[float] = 0.5
    BORDERLINE_MARGIN: ClassVar[float] = 0.05

    picture_count: int
    recognized_count: int
    task: RecognitionTask
    classes: tuple[ClassStatistics, ...]
    pictures: tuple[PictureStatistics, ...]
    co_occurrence: ClassMatrix
    overlaps: ClassMatrix | None
    runner_ups: ClassMatrix | None
    margins: ConfidenceHistogram | None

    @classmethod
    def of(
        cls,
        task: RecognitionTask,
        catalog: ResultCatalog,
        frame_keys: Sequence[FrameKey],
        class_names: Sequence[str],
        review_filter: ReviewFilter,
    ) -> "ResultStatistics":
        """
        Gather the statistics of some pictures.

        Parameters
        ----------
        task : RecognitionTask
            Task of the profile.
        catalog : ResultCatalog
            Results of the profile.
        frame_keys : Sequence[FrameKey]
            Pictures to consider.
        class_names : Sequence[str]
            Current classes, listed first even without findings.
        review_filter : ReviewFilter
            Label mode, minimums and duplicate suppression of the review; accepted findings failing it count as below
            the minimum.

        Returns
        -------
        ResultStatistics
            Statistics of the recognized pictures among ``frame_keys``.
        """
        names: dict[str, None] = dict.fromkeys(class_names)
        confidences: defaultdict[str, list[float]] = defaultdict(list)
        kept_confidences: defaultdict[str, list[float]] = defaultdict(list)
        accepted_by_picture: defaultdict[str, list[list[float]]] = defaultdict(list)
        rejected: Counter[str] = Counter()
        below: Counter[str] = Counter()
        pictures_with: Counter[str] = Counter()
        peaks: Counter[str] = Counter()
        areas: defaultdict[str, list[float]] = defaultdict(list)
        area_shares: defaultdict[str, list[float]] = defaultdict(list)
        co_occurrence: Counter[tuple[str, str]] = Counter()
        overlaps: Counter[tuple[str, str]] = Counter()
        runner_ups: Counter[tuple[str, str]] = Counter()
        margins: list[float] = []
        pictures: list[PictureStatistics] = []
        is_classification: bool = task is RecognitionTask.CLASSIFICATION
        for frame_key in frame_keys:
            stored: StoredResult | None = catalog.stored_of(frame_key)
            if stored is None:
                continue
            findings: tuple[Finding, ...] = review_filter.findings_of(stored.result)
            kept: frozenset[int] = stored.kept_indices(review_filter)
            picture_area: float = float(stored.result.image_size.width * stored.result.image_size.height)
            accepted: defaultdict[str, list[float]] = defaultdict(list)
            kept_classes: Counter[str] = Counter()
            borderline_count: int = 0
            for finding in findings:
                names.setdefault(finding.class_name)
                confidences[finding.class_name].append(finding.confidence)
                if not stored.is_accepted(finding.index):
                    rejected[finding.class_name] += 1
                    continue
                accepted[finding.class_name].append(finding.confidence)
                minimum: float = review_filter.thresholds.minimum_of(finding.class_name, finding.matched_prompt)
                if abs(finding.confidence - minimum) <= cls.BORDERLINE_MARGIN:
                    borderline_count += 1
                if finding.index not in kept:
                    below[finding.class_name] += 1
                    continue
                kept_classes[finding.class_name] += 1
                kept_confidences[finding.class_name].append(finding.confidence)
                if finding.area is not None:
                    areas[finding.class_name].append(finding.area)
                    area_shares[finding.class_name].append(min(1.0, finding.area / picture_area))
            for class_name, class_confidences in accepted.items():
                accepted_by_picture[class_name].append(class_confidences)
            for class_name, count in kept_classes.items():
                pictures_with[class_name] += 1
                peaks[class_name] = max(peaks[class_name], count)
                for other_name in kept_classes:
                    co_occurrence[class_name, other_name] += 1
            top_margin: float | None = None
            ranked: tuple[ClassScore, ...] = stored.result.ranked_scores
            if len(ranked) >= 2:
                top_margin = max(0.0, min(1.0, ranked[0].score - ranked[1].score))
                margins.append(top_margin)
                runner_ups[ranked[0].class_name, ranked[1].class_name] += 1
            if not is_classification:
                cls._count_overlaps(stored.result.instances, kept, overlaps)
            best: float | None = max((value for values in accepted.values() for value in values), default=None)
            pictures.append(
                PictureStatistics(
                    frame_key=frame_key,
                    finding_count=len(findings),
                    kept_count=kept_classes.total(),
                    kept_class_names=tuple(name for name, _ in kept_classes.most_common()),
                    best_confidence=best,
                    borderline_count=borderline_count,
                    top_margin=top_margin,
                )
            )
        ordered_names: tuple[str, ...] = tuple(names)
        return cls(
            picture_count=len(frame_keys),
            recognized_count=len(pictures),
            task=task,
            classes=tuple(
                ClassStatistics(
                    class_name=name,
                    picture_count=pictures_with[name],
                    finding_count=len(confidences[name]),
                    rejected_count=rejected[name],
                    below_minimum_count=below[name],
                    kept_count=len(kept_confidences[name]),
                    peak_count=peaks[name],
                    confidences=ConfidenceSummary.of(confidences[name]),
                    kept_confidences=ConfidenceSummary.of(kept_confidences[name]),
                    threshold_curve=ThresholdCurve.of(accepted_by_picture[name]),
                    sizes=None if is_classification else SizeDistribution.of(areas[name], area_shares[name]),
                )
                for name in ordered_names
            ),
            pictures=tuple(pictures),
            co_occurrence=ClassMatrix.of(ordered_names, co_occurrence),
            overlaps=None if is_classification else ClassMatrix.of(ordered_names, overlaps),
            runner_ups=ClassMatrix.of(ordered_names, runner_ups) if is_classification else None,
            margins=ConfidenceHistogram.of(margins) if is_classification else None,
        )

    @property
    def is_classification(self) -> bool:
        """
        Whether the results classify whole pictures rather than find instances.

        Returns
        -------
        bool
            True for a classification profile.
        """
        return self.task is RecognitionTask.CLASSIFICATION

    @property
    def kept_count(self) -> int:
        """
        Kept findings over every class.

        Returns
        -------
        int
            Sum of the kept counts.
        """
        return sum(entry.kept_count for entry in self.classes)

    @property
    def finding_count(self) -> int:
        """
        Stored findings over every class.

        Returns
        -------
        int
            Sum of the finding counts.
        """
        return sum(entry.finding_count for entry in self.classes)

    @property
    def rejected_count(self) -> int:
        """
        Rejected findings over every class.

        Returns
        -------
        int
            Sum of the rejected counts.
        """
        return sum(entry.rejected_count for entry in self.classes)

    @property
    def below_minimum_count(self) -> int:
        """
        Filtered-out findings over every class.

        Returns
        -------
        int
            Sum of the below-minimum counts.
        """
        return sum(entry.below_minimum_count for entry in self.classes)

    @property
    def empty_picture_count(self) -> int:
        """
        Recognized pictures without a kept finding.

        Returns
        -------
        int
            Count of pictures keeping nothing.
        """
        return sum(1 for picture in self.pictures if picture.kept_count == 0)

    def most_kept_pictures(self, limit: int) -> tuple[PictureStatistics, ...]:
        """
        Pictures keeping the most findings.

        Parameters
        ----------
        limit : int
            Most pictures returned.

        Returns
        -------
        tuple[PictureStatistics, ...]
            Pictures keeping anything, most kept findings first.
        """
        ranked: list[PictureStatistics] = sorted(
            (picture for picture in self.pictures if picture.kept_count > 0), key=lambda picture: -picture.kept_count
        )
        return tuple(ranked[:limit])

    def empty_pictures(self, limit: int) -> tuple[PictureStatistics, ...]:
        """
        Recognized pictures keeping nothing, those closest to keeping a finding first.

        Parameters
        ----------
        limit : int
            Most pictures returned.

        Returns
        -------
        tuple[PictureStatistics, ...]
            Pictures by descending best confidence, pictures without any accepted finding last.
        """
        ranked: list[PictureStatistics] = sorted(
            (picture for picture in self.pictures if picture.kept_count == 0),
            key=lambda picture: 1.0 if picture.best_confidence is None else -picture.best_confidence,
        )
        return tuple(ranked[:limit])

    def borderline_pictures(self, limit: int) -> tuple[PictureStatistics, ...]:
        """
        Pictures whose kept findings depend most on the exact minimums.

        Parameters
        ----------
        limit : int
            Most pictures returned.

        Returns
        -------
        tuple[PictureStatistics, ...]
            Pictures with borderline findings, most first.
        """
        ranked: list[PictureStatistics] = sorted(
            (picture for picture in self.pictures if picture.borderline_count > 0),
            key=lambda picture: -picture.borderline_count,
        )
        return tuple(ranked[:limit])

    @property
    def borderline_picture_count(self) -> int:
        """
        Pictures with at least one borderline finding.

        Returns
        -------
        int
            Count of such pictures.
        """
        return sum(1 for picture in self.pictures if picture.borderline_count > 0)

    def ambiguous_pictures(self, limit: int) -> tuple[PictureStatistics, ...]:
        """
        Classified pictures whose top two classes score closest.

        Parameters
        ----------
        limit : int
            Most pictures returned.

        Returns
        -------
        tuple[PictureStatistics, ...]
            Pictures by ascending top margin; empty unless classifying.
        """
        ranked: list[PictureStatistics] = sorted(
            (picture for picture in self.pictures if picture.top_margin is not None),
            key=lambda picture: picture.top_margin if picture.top_margin is not None else 1.0,
        )
        return tuple(ranked[:limit])

    def kept_count_distribution(self, bucket_count: int) -> tuple[int, ...]:
        """
        Pictures by how many findings they keep.

        Parameters
        ----------
        bucket_count : int
            Buckets; the last one gathers every picture keeping ``bucket_count - 1`` findings or more.

        Returns
        -------
        tuple[int, ...]
            Pictures keeping 0, 1, … findings.

        Raises
        ------
        ValueError
            If ``bucket_count`` is below 2.
        """
        if bucket_count < 2:
            raise ValueError(f"bucket_count must be at least 2. got {bucket_count}")
        buckets: list[int] = [0] * bucket_count
        for picture in self.pictures:
            buckets[min(picture.kept_count, bucket_count - 1)] += 1
        return tuple(buckets)

    @classmethod
    def _count_overlaps(
        cls,
        instances: Sequence[RecognizedInstance],
        kept: frozenset[int],
        overlaps: Counter[tuple[str, str]],
    ) -> None:
        kept_instances: list[RecognizedInstance] = [
            instance for index, instance in enumerate(instances) if index in kept
        ]
        for first_position, first in enumerate(kept_instances):
            for second in kept_instances[first_position + 1 :]:
                if first.class_name == second.class_name:
                    continue
                if InstanceMatcher.overlap(first, second) >= cls.OVERLAP_THRESHOLD:
                    overlaps[first.class_name, second.class_name] += 1
                    overlaps[second.class_name, first.class_name] += 1
