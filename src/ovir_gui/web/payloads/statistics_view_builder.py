from ...analysis import ClassComparison, ClassStatistics, ConfidenceHistogram, ProfileComparison, ResultStatistics
from ...models import ModelProfile
from ...workspace import Workspace
from ..json_value import JsonObject, JsonValue


class StatisticsViewBuilder:
    """
    JSON document of the per-class statistics of the shown results and their comparison with another profile.
    """

    @classmethod
    def statistics(cls, workspace: Workspace) -> JsonObject:
        """
        Per-class statistics of the shown results and the comparison with another profile.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.

        Returns
        -------
        JsonObject
            Shown model, statistics and comparison; ``null`` parts are not available.
        """
        shown: ModelProfile | None = workspace.shown_profile
        statistics: ResultStatistics | None = workspace.read_model.statistics()
        comparison: ProfileComparison | None = workspace.read_model.comparison()
        return {
            "model": None if shown is None else shown.label,
            "task": workspace.task.value,
            "statistics": None if statistics is None else cls._result_statistics(statistics),
            "comparison": None if comparison is None else cls._comparison(comparison),
        }

    @classmethod
    def _result_statistics(cls, statistics: ResultStatistics) -> JsonObject:
        return {
            "picture_count": statistics.picture_count,
            "recognized_count": statistics.recognized_count,
            "classes": [cls._class_statistics(entry) for entry in statistics.classes],
            "histogram": cls._histogram(statistics.histogram),
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
            "mean_confidence": entry.mean_confidence,
            "median_confidence": entry.median_confidence,
            "histogram": cls._histogram(entry.histogram),
        }

    @staticmethod
    def _histogram(histogram: ConfidenceHistogram) -> JsonObject:
        return {"bin_counts": list[JsonValue](histogram.bin_counts), "bin_width": histogram.bin_width}

    @classmethod
    def _comparison(cls, comparison: ProfileComparison) -> JsonObject:
        return {
            "picture_count": comparison.picture_count,
            "iou_threshold": comparison.iou_threshold,
            "classes": [cls._class_comparison(entry) for entry in comparison.classes],
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
        }
