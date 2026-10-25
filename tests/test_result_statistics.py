from pathlib import Path

import pytest

from ovir_gui.analysis import (
    ConfidenceSummary,
    ProfileComparison,
    ResultStatistics,
    SizeBand,
    ThresholdCurve,
)
from ovir_gui.media import FrameKey
from ovir_gui.prompting import PromptSignature
from ovir_gui.recognition import ClassScore, FrameResult, ImageSize, PixelBox, RecognitionTask, RecognizedInstance
from ovir_gui.results import ResultCatalog
from ovir_gui.review import ClassThresholds, DuplicateSuppression, ReviewFilter

FIRST: FrameKey = FrameKey(Path("/media/first.png"))
SECOND: FrameKey = FrameKey(Path("/media/second.png"))
THIRD: FrameKey = FrameKey(Path("/media/third.png"))
SIZE: ImageSize = ImageSize(200, 100)


def instance_of(class_name: str, confidence: float, left: float, width: float = 40.0) -> RecognizedInstance:
    return RecognizedInstance(
        class_name=class_name,
        query_label=class_name,
        confidence=confidence,
        box=PixelBox(left, 0.0, left + width, 40.0),
    )


def detection_of(*instances: RecognizedInstance) -> FrameResult:
    return FrameResult(task=RecognitionTask.DETECTION, image_size=SIZE, instances=instances)


def classification_of(*scores: tuple[str, float]) -> FrameResult:
    return FrameResult(
        task=RecognitionTask.CLASSIFICATION,
        image_size=SIZE,
        class_scores=tuple(
            ClassScore(class_name=name, score=score, logit=score, query_label=name, similarity=None)
            for name, score in scores
        ),
    )


def catalog_of(results: dict[FrameKey, FrameResult]) -> ResultCatalog:
    catalog: ResultCatalog = ResultCatalog()
    for frame_key, result in results.items():
        catalog.record(frame_key, result, PromptSignature(()))
    return catalog


class TestThresholdCurve:
    """
    The curve counts what every minimum would keep, by findings and by pictures.
    """

    def test_counts_reach_each_step(self) -> None:
        curve: ThresholdCurve = ThresholdCurve.of([[0.3, 0.8], [0.5]])
        assert curve.finding_counts[0] == 3
        assert curve.finding_counts[30] == 3
        assert curve.finding_counts[31] == 2
        assert curve.finding_counts[50] == 2
        assert curve.finding_counts[51] == 1
        assert curve.finding_counts[100] == 0
        assert curve.picture_counts[50] == 2
        assert curve.picture_counts[51] == 1
        assert curve.picture_counts[81] == 0

    def test_full_confidence_reaches_the_last_step(self) -> None:
        assert ThresholdCurve.of([[1.0]]).finding_counts[100] == 1


class TestConfidenceSummary:
    """
    Quantiles interpolate between the closest confidences.
    """

    def test_quantiles(self) -> None:
        summary: ConfidenceSummary | None = ConfidenceSummary.of([0.4, 0.0, 0.2, 0.1, 0.3])
        assert summary is not None
        assert summary.median == pytest.approx(0.2)
        assert summary.lower_quartile == pytest.approx(0.1)
        assert summary.upper_decile == pytest.approx(0.36)
        assert summary.mean == pytest.approx(0.2)

    def test_no_confidences(self) -> None:
        assert ConfidenceSummary.of([]) is None


class TestSizeBand:
    """
    Sizes follow the COCO bounds.
    """

    def test_bounds(self) -> None:
        assert SizeBand.of_area(32.0**2 - 1.0) is SizeBand.SMALL
        assert SizeBand.of_area(32.0**2) is SizeBand.MEDIUM
        assert SizeBand.of_area(96.0**2) is SizeBand.LARGE


class TestResultStatistics:
    """
    Classes, pictures and class relations of one profile, after the review.
    """

    def test_detection(self) -> None:
        catalog: ResultCatalog = catalog_of(
            {
                FIRST: detection_of(
                    instance_of("car", 0.9, 0.0),
                    instance_of("bus", 0.7, 2.0),
                    instance_of("car", 0.62, 120.0),
                    instance_of("dog", 0.2, 60.0),
                ),
                SECOND: detection_of(instance_of("dog", 0.4, 0.0, width=10.0)),
                THIRD: detection_of(instance_of("car", 0.1, 0.0)),
            }
        )
        catalog.set_accepted(SECOND, [0], False)
        statistics: ResultStatistics = ResultStatistics.of(
            RecognitionTask.DETECTION,
            catalog,
            (FIRST, SECOND, THIRD),
            ("car", "dog", "bus"),
            ReviewFilter(ClassThresholds(0.6), DuplicateSuppression()),
        )
        car, dog = statistics.classes[:2]
        assert (car.finding_count, car.kept_count, car.below_minimum_count, car.picture_count) == (3, 2, 1, 1)
        assert car.peak_count == 2
        assert (dog.rejected_count, dog.below_minimum_count, dog.kept_count) == (1, 1, 0)
        assert car.threshold_curve.picture_counts[10] == 2
        assert car.sizes is not None
        assert (car.sizes.small_count, car.sizes.medium_count) == (0, 2)
        assert car.sizes.median_area_share == pytest.approx(0.08)
        assert statistics.co_occurrence.counts[0] == (1, 0, 1)
        assert statistics.overlaps is not None
        assert statistics.overlaps.counts[0][2] == 1
        assert statistics.overlaps.off_diagonal_count == 2
        assert statistics.runner_ups is None
        assert statistics.empty_picture_count == 2
        assert statistics.kept_count_distribution(3) == (2, 0, 1)
        assert [picture.frame_key for picture in statistics.empty_pictures(5)] == [THIRD, SECOND]
        assert statistics.pictures[0].kept_class_names == ("car", "bus")
        assert statistics.pictures[0].borderline_count == 1
        assert [picture.frame_key for picture in statistics.borderline_pictures(5)] == [FIRST]

    def test_classification(self) -> None:
        catalog: ResultCatalog = catalog_of(
            {
                FIRST: classification_of(("indoor", 0.55), ("outdoor", 0.45)),
                SECOND: classification_of(("indoor", 0.1), ("outdoor", 0.9)),
            }
        )
        statistics: ResultStatistics = ResultStatistics.of(
            RecognitionTask.CLASSIFICATION,
            catalog,
            (FIRST, SECOND),
            ("indoor", "outdoor"),
            ReviewFilter(ClassThresholds(), DuplicateSuppression()),
        )
        assert statistics.overlaps is None
        assert statistics.runner_ups is not None
        assert statistics.runner_ups.counts == ((0, 1), (1, 0))
        assert statistics.margins is not None
        assert statistics.margins.total_count == 2
        assert statistics.classes[0].sizes is None
        assert [picture.frame_key for picture in statistics.ambiguous_pictures(1)] == [FIRST]


class TestProfileComparison:
    """
    Two profiles are compared on their kept findings only.
    """

    def test_detection_pairs_kept_instances(self) -> None:
        shown: ResultCatalog = catalog_of(
            {FIRST: detection_of(instance_of("car", 0.9, 0.0), instance_of("car", 0.2, 100.0))}
        )
        compared: ResultCatalog = catalog_of(
            {FIRST: detection_of(instance_of("car", 0.8, 4.0), instance_of("car", 0.7, 150.0))}
        )
        comparison: ProfileComparison = ProfileComparison.between(
            shown, compared, (FIRST,), ("car",), ReviewFilter(ClassThresholds(0.5), DuplicateSuppression())
        )
        car = comparison.classes[0]
        assert (car.shown_count, car.compared_count, car.matched_count) == (1, 2, 1)
        assert car.agreement == pytest.approx(0.5)
        assert car.mean_matched_overlap == pytest.approx(36.0 / 44.0)
        assert comparison.confusion is None
        assert comparison.most_disagreeing_pictures(5)[0].compared_only_count == 1

    def test_classification_confusion(self) -> None:
        shown: ResultCatalog = catalog_of(
            {
                FIRST: classification_of(("indoor", 0.8), ("outdoor", 0.2)),
                SECOND: classification_of(("indoor", 0.3), ("outdoor", 0.7)),
            }
        )
        compared: ResultCatalog = catalog_of(
            {
                FIRST: classification_of(("indoor", 0.4), ("outdoor", 0.6)),
                SECOND: classification_of(("indoor", 0.2), ("outdoor", 0.8)),
            }
        )
        comparison: ProfileComparison = ProfileComparison.between(
            shown,
            compared,
            (FIRST, SECOND),
            ("indoor", "outdoor"),
            ReviewFilter(ClassThresholds(0.5), DuplicateSuppression()),
        )
        assert comparison.confusion is not None
        assert comparison.confusion.counts == ((0, 1), (0, 1))
        assert comparison.disagreeing_picture_count == 1
