from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass

from ..media import FrameKey
from ..recognition import RecognizedInstance
from ..results import ResultCatalog, StoredResult
from ..review import ReviewFilter
from .class_comparison import ClassComparison
from .class_matrix import ClassMatrix
from .instance_matcher import InstanceMatcher
from .picture_disagreement import PictureDisagreement


@dataclass(frozen=True)
class ProfileComparison:
    """
    Class-by-class comparison of the kept findings of two profiles of one task on the pictures both recognized.

    Instances are paired one to one by overlap within each class; classifications agree on each class both models
    keep for the picture, which in single-label mode means keeping the same best class.

    Attributes
    ----------
    picture_count : int
        Pictures both profiles recognized.
    iou_threshold : float
        Smallest overlap of a pair of instances.
    classes : tuple[ClassComparison, ...]
        Comparison of the current classes, then of classes only results report.
    pictures : tuple[PictureDisagreement, ...]
        Counts of every picture both profiles recognized, in the order considered.
    confusion : ClassMatrix | None
        Pictures per kept class of the shown (row) and the compared (column) model, a multi-label picture counting
        every pair of its kept classes; ``None`` unless classifying.
    """

    picture_count: int
    iou_threshold: float
    classes: tuple[ClassComparison, ...]
    pictures: tuple[PictureDisagreement, ...]
    confusion: ClassMatrix | None

    @classmethod
    def between(
        cls,
        shown: ResultCatalog,
        compared: ResultCatalog,
        frame_keys: Sequence[FrameKey],
        class_names: Sequence[str],
        review_filter: ReviewFilter,
        matcher: InstanceMatcher | None = None,
    ) -> "ProfileComparison":
        """
        Compare two profiles.

        Parameters
        ----------
        shown : ResultCatalog
            Results of the shown profile.
        compared : ResultCatalog
            Results of the compared profile.
        frame_keys : Sequence[FrameKey]
            Pictures to consider.
        class_names : Sequence[str]
            Current classes, listed first.
        review_filter : ReviewFilter
            Review deciding which findings of either profile are kept.
        matcher : InstanceMatcher | None, optional
            Pairing of instances; IoU 0.5 by default.

        Returns
        -------
        ProfileComparison
            Counts per class and per picture.
        """
        instance_matcher: InstanceMatcher = matcher or InstanceMatcher()
        names: dict[str, None] = dict.fromkeys(class_names)
        shown_counts: Counter[str] = Counter()
        compared_counts: Counter[str] = Counter()
        matched_counts: Counter[str] = Counter()
        matched_overlaps: defaultdict[str, list[float]] = defaultdict(list)
        confusion: Counter[tuple[str, str]] = Counter()
        pictures: list[PictureDisagreement] = []
        is_classification: bool = False
        for frame_key in frame_keys:
            shown_stored: StoredResult | None = shown.stored_of(frame_key)
            compared_stored: StoredResult | None = compared.stored_of(frame_key)
            if shown_stored is None or compared_stored is None:
                continue
            for name in (*shown_stored.result.class_names, *compared_stored.result.class_names):
                names.setdefault(name)
            if shown_stored.result.class_scores:
                is_classification = True
                shown_labels: frozenset[str] = cls._kept_labels_of(shown_stored, review_filter)
                compared_labels: frozenset[str] = cls._kept_labels_of(compared_stored, review_filter)
                matched_labels: frozenset[str] = shown_labels & compared_labels
                shown_counts.update(shown_labels)
                compared_counts.update(compared_labels)
                matched_counts.update(matched_labels)
                for shown_label in shown_labels:
                    for compared_label in compared_labels:
                        confusion[shown_label, compared_label] += 1
                pictures.append(
                    PictureDisagreement(
                        frame_key=frame_key,
                        shown_count=len(shown_labels),
                        compared_count=len(compared_labels),
                        matched_count=len(matched_labels),
                    )
                )
                continue
            shown_kept: list[RecognizedInstance] = cls._kept_instances_of(shown_stored, review_filter)
            compared_kept: list[RecognizedInstance] = cls._kept_instances_of(compared_stored, review_filter)
            picture_matched_count: int = 0
            for name in names:
                shown_instances: list[RecognizedInstance] = [item for item in shown_kept if item.class_name == name]
                compared_instances: list[RecognizedInstance] = [
                    item for item in compared_kept if item.class_name == name
                ]
                shown_counts[name] += len(shown_instances)
                compared_counts[name] += len(compared_instances)
                if not shown_instances or not compared_instances:
                    continue
                for shown_index, compared_index in instance_matcher.pairs(shown_instances, compared_instances):
                    matched_counts[name] += 1
                    picture_matched_count += 1
                    matched_overlaps[name].append(
                        instance_matcher.overlap(shown_instances[shown_index], compared_instances[compared_index])
                    )
            pictures.append(
                PictureDisagreement(
                    frame_key=frame_key,
                    shown_count=len(shown_kept),
                    compared_count=len(compared_kept),
                    matched_count=picture_matched_count,
                )
            )
        ordered_names: tuple[str, ...] = tuple(names)
        return cls(
            picture_count=len(pictures),
            iou_threshold=instance_matcher.iou_threshold,
            classes=tuple(
                ClassComparison(
                    class_name=name,
                    shown_count=shown_counts[name],
                    compared_count=compared_counts[name],
                    matched_count=matched_counts[name],
                    mean_matched_overlap=(
                        sum(matched_overlaps[name]) / len(matched_overlaps[name]) if matched_overlaps[name] else None
                    ),
                )
                for name in ordered_names
            ),
            pictures=tuple(pictures),
            confusion=ClassMatrix.of(ordered_names, confusion) if is_classification else None,
        )

    @property
    def is_classification(self) -> bool:
        """
        Whether the profiles classify whole pictures.

        Returns
        -------
        bool
            True when a confusion matrix is available.
        """
        return self.confusion is not None

    def most_disagreeing_pictures(self, limit: int) -> tuple[PictureDisagreement, ...]:
        """
        Pictures where the two models differ most.

        Parameters
        ----------
        limit : int
            Most pictures returned.

        Returns
        -------
        tuple[PictureDisagreement, ...]
            Pictures with unmatched findings, most unmatched first.
        """
        ranked: list[PictureDisagreement] = sorted(
            (picture for picture in self.pictures if picture.unmatched_count > 0),
            key=lambda picture: -picture.unmatched_count,
        )
        return tuple(ranked[:limit])

    @property
    def disagreeing_picture_count(self) -> int:
        """
        Pictures with at least one unmatched finding.

        Returns
        -------
        int
            Count of such pictures.
        """
        return sum(1 for picture in self.pictures if picture.unmatched_count > 0)

    @staticmethod
    def _kept_labels_of(stored: StoredResult, review_filter: ReviewFilter) -> frozenset[str]:
        kept: frozenset[int] = stored.kept_indices(review_filter)
        return frozenset(
            finding.class_name for finding in review_filter.findings_of(stored.result) if finding.index in kept
        )

    @staticmethod
    def _kept_instances_of(stored: StoredResult, review_filter: ReviewFilter) -> list[RecognizedInstance]:
        kept: frozenset[int] = stored.kept_indices(review_filter)
        return [instance for index, instance in enumerate(stored.result.instances) if index in kept]
