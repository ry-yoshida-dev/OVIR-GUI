from collections.abc import Sequence
from dataclasses import dataclass

from ..media import FrameKey
from ..recognition import FrameResult, RecognizedInstance
from ..results import ResultCatalog
from .class_comparison import ClassComparison
from .instance_matcher import InstanceMatcher


@dataclass(frozen=True)
class ProfileComparison:
    """
    Class-by-class comparison of two profiles of one task on the pictures both recognized.

    Instances are paired one to one by overlap within each class; classifications agree when both models give the
    picture the same top class.

    Attributes
    ----------
    picture_count : int
        Pictures both profiles recognized.
    iou_threshold : float
        Smallest overlap of a pair of instances.
    classes : tuple[ClassComparison, ...]
        Comparison of the current classes, then of classes only results report.
    """

    picture_count: int
    iou_threshold: float
    classes: tuple[ClassComparison, ...]

    @classmethod
    def between(
        cls,
        shown: ResultCatalog,
        compared: ResultCatalog,
        frame_keys: Sequence[FrameKey],
        class_names: Sequence[str],
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
        matcher : InstanceMatcher | None, optional
            Pairing of instances; IoU 0.5 by default.

        Returns
        -------
        ProfileComparison
            Counts per class.
        """
        instance_matcher: InstanceMatcher = matcher or InstanceMatcher()
        names: list[str] = list(class_names)
        counts: dict[str, list[int]] = {name: [0, 0, 0] for name in names}
        picture_count: int = 0
        for frame_key in frame_keys:
            shown_result: FrameResult | None = shown.result_of(frame_key)
            compared_result: FrameResult | None = compared.result_of(frame_key)
            if shown_result is None or compared_result is None:
                continue
            picture_count += 1
            for name in (*shown_result.class_names, *compared_result.class_names):
                if name not in counts:
                    names.append(name)
                    counts[name] = [0, 0, 0]
            if shown_result.class_scores:
                shown_top: str = shown_result.findings[0].class_name
                compared_top: str = compared_result.findings[0].class_name if compared_result.class_scores else ""
                counts[shown_top][0] += 1
                if compared_top:
                    counts[compared_top][1] += 1
                if shown_top == compared_top:
                    counts[shown_top][2] += 1
                continue
            for name, class_counts in counts.items():
                shown_instances: list[RecognizedInstance] = [
                    instance for instance in shown_result.instances if instance.class_name == name
                ]
                compared_instances: list[RecognizedInstance] = [
                    instance for instance in compared_result.instances if instance.class_name == name
                ]
                class_counts[0] += len(shown_instances)
                class_counts[1] += len(compared_instances)
                class_counts[2] += len(instance_matcher.pairs(shown_instances, compared_instances))
        return cls(
            picture_count=picture_count,
            iou_threshold=instance_matcher.iou_threshold,
            classes=tuple(
                ClassComparison(
                    class_name=name,
                    shown_count=counts[name][0],
                    compared_count=counts[name][1],
                    matched_count=counts[name][2],
                )
                for name in names
            ),
        )
