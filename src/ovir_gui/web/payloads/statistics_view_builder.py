from collections.abc import Iterable
from typing import ClassVar

from ...analysis import (
    ClassComparison,
    ClassMatrix,
    ClassStatistics,
    ConfidenceHistogram,
    ConfidenceSummary,
    PictureDisagreement,
    PictureStatistics,
    ProfileComparison,
    ResultStatistics,
    SizeDistribution,
    ThresholdCurve,
)
from ...models import ModelProfile
from ...workspace import Workspace
from ..json_value import JsonObject, JsonValue


class StatisticsViewBuilder:
    """
    JSON document of the statistics of the shown results and their comparison with another profile.
    """

    PICTURE_LIST_LIMIT: ClassVar[int] = 40
    KEPT_COUNT_BUCKETS: ClassVar[int] = 11

    @classmethod
    def statistics(cls, workspace: Workspace) -> JsonObject:
        """
        Statistics of the shown results and the comparison with another profile.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.

        Returns
        -------
        JsonObject
            Shown and compared models, statistics and comparison; ``null`` parts are not available.
        """
        shown: ModelProfile | None = workspace.shown_profile
        compared: ModelProfile | None = workspace.compared_profile
        statistics: ResultStatistics | None = workspace.read_model.statistics()
        comparison: ProfileComparison | None = workspace.read_model.comparison()
        return {
            "model": None if shown is None else shown.label,
            "compared_model": None if compared is None else compared.label,
            "task": workspace.task.value,
            "statistics": None if statistics is None else cls._result_statistics(statistics),
            "comparison": None if comparison is None else cls._comparison(comparison),
        }

    @classmethod
    def _result_statistics(cls, statistics: ResultStatistics) -> JsonObject:
        limit: int = cls.PICTURE_LIST_LIMIT
        return {
            "picture_count": statistics.picture_count,
            "recognized_count": statistics.recognized_count,
            "finding_count": statistics.finding_count,
            "kept_count": statistics.kept_count,
            "rejected_count": statistics.rejected_count,
            "below_minimum_count": statistics.below_minimum_count,
            "empty_picture_count": statistics.empty_picture_count,
            "borderline_picture_count": statistics.borderline_picture_count,
            "threshold_step_count": ThresholdCurve.STEP_COUNT,
            "borderline_margin": ResultStatistics.BORDERLINE_MARGIN,
            "overlap_threshold": ResultStatistics.OVERLAP_THRESHOLD,
            "classes": [cls._class_statistics(entry) for entry in statistics.classes],
            "kept_count_distribution": list[JsonValue](statistics.kept_count_distribution(cls.KEPT_COUNT_BUCKETS)),
            "picture_lists": {
                "most_kept": cls._pictures(statistics.most_kept_pictures(limit)),
                "empty": cls._pictures(statistics.empty_pictures(limit)),
                "borderline": cls._pictures(statistics.borderline_pictures(limit)),
                "ambiguous": cls._pictures(statistics.ambiguous_pictures(limit)),
            },
            "co_occurrence": cls._matrix(statistics.co_occurrence),
            "overlaps": None if statistics.overlaps is None else cls._matrix(statistics.overlaps),
            "runner_ups": None if statistics.runner_ups is None else cls._matrix(statistics.runner_ups),
            "margins": None if statistics.margins is None else cls._histogram(statistics.margins),
        }

    @classmethod
    def _class_statistics(cls, entry: ClassStatistics) -> JsonObject:
        return {
            "class_name": entry.class_name,
            "picture_count": entry.picture_count,
            "finding_count": entry.finding_count,
            "rejected_count": entry.rejected_count,
            "below_minimum_count": entry.below_minimum_count,
            "kept_count": entry.kept_count,
            "peak_count": entry.peak_count,
            "confidences": cls._summary(entry.confidences),
            "kept_confidences": cls._summary(entry.kept_confidences),
            "threshold_curve": {
                "finding_counts": list[JsonValue](entry.threshold_curve.finding_counts),
                "picture_counts": list[JsonValue](entry.threshold_curve.picture_counts),
            },
            "sizes": None if entry.sizes is None else cls._sizes(entry.sizes),
        }

    @staticmethod
    def _summary(summary: ConfidenceSummary | None) -> JsonValue:
        if summary is None:
            return None
        return {
            "count": summary.count,
            "minimum": summary.minimum,
            "lower_decile": summary.lower_decile,
            "lower_quartile": summary.lower_quartile,
            "median": summary.median,
            "upper_quartile": summary.upper_quartile,
            "upper_decile": summary.upper_decile,
            "maximum": summary.maximum,
            "mean": summary.mean,
        }

    @staticmethod
    def _sizes(sizes: SizeDistribution) -> JsonObject:
        return {
            "small_count": sizes.small_count,
            "medium_count": sizes.medium_count,
            "large_count": sizes.large_count,
            "median_area_share": sizes.median_area_share,
        }

    @staticmethod
    def _pictures(pictures: Iterable[PictureStatistics]) -> list[JsonValue]:
        return [
            {
                "path": str(picture.frame_key.path),
                "frame": picture.frame_key.frame_index,
                "label": picture.frame_key.label,
                "finding_count": picture.finding_count,
                "kept_count": picture.kept_count,
                "kept_class_names": list[JsonValue](picture.kept_class_names),
                "best_confidence": picture.best_confidence,
                "borderline_count": picture.borderline_count,
                "top_margin": picture.top_margin,
            }
            for picture in pictures
        ]

    @staticmethod
    def _matrix(matrix: ClassMatrix) -> JsonObject:
        return {
            "class_names": list[JsonValue](matrix.class_names),
            "counts": [list[JsonValue](row) for row in matrix.counts],
        }

    @staticmethod
    def _histogram(histogram: ConfidenceHistogram) -> JsonObject:
        return {"bin_counts": list[JsonValue](histogram.bin_counts), "bin_width": histogram.bin_width}

    @classmethod
    def _comparison(cls, comparison: ProfileComparison) -> JsonObject:
        return {
            "picture_count": comparison.picture_count,
            "iou_threshold": comparison.iou_threshold,
            "disagreeing_picture_count": comparison.disagreeing_picture_count,
            "classes": [cls._class_comparison(entry) for entry in comparison.classes],
            "pictures": cls._disagreements(comparison.most_disagreeing_pictures(cls.PICTURE_LIST_LIMIT)),
            "confusion": None if comparison.confusion is None else cls._matrix(comparison.confusion),
        }

    @staticmethod
    def _class_comparison(entry: ClassComparison) -> JsonObject:
        return {
            "class_name": entry.class_name,
            "shown_count": entry.shown_count,
            "compared_count": entry.compared_count,
            "matched_count": entry.matched_count,
            "shown_only_count": entry.shown_only_count,
            "compared_only_count": entry.compared_only_count,
            "agreement": entry.agreement,
            "mean_matched_overlap": entry.mean_matched_overlap,
        }

    @staticmethod
    def _disagreements(pictures: Iterable[PictureDisagreement]) -> list[JsonValue]:
        return [
            {
                "path": str(picture.frame_key.path),
                "frame": picture.frame_key.frame_index,
                "label": picture.frame_key.label,
                "shown_count": picture.shown_count,
                "compared_count": picture.compared_count,
                "matched_count": picture.matched_count,
                "shown_only_count": picture.shown_only_count,
                "compared_only_count": picture.compared_only_count,
            }
            for picture in pictures
        ]
