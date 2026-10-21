from pathlib import Path

from ovir_gui.recognition import Finding, PixelBox, RecognitionTask
from ovir_gui.review import ClassThresholds, DuplicateSuppression, ReviewFilter
from ovir_gui.storage import ClassThresholdStore, DuplicateSuppressionStore


def finding_of(index: int, class_name: str, query_label: str, confidence: float, left: float) -> Finding:
    return Finding(
        index=index,
        class_name=class_name,
        query_label=query_label,
        confidence=confidence,
        box=PixelBox(left, 0.0, left + 10.0, 10.0),
        area=100.0,
    )


class TestReviewFilter:
    """
    Findings pass when they reach the minimum of their phrase and are not a lower-scored duplicate of their class.
    """

    def test_phrase_minimum_replaces_class_minimum(self) -> None:
        thresholds: ClassThresholds = ClassThresholds(0.2, {"car": 0.4}, {"car": {"suv": 0.8}})
        assert thresholds.minimum_of("car") == 0.4
        assert thresholds.minimum_of("car", "taxi") == 0.4
        assert thresholds.minimum_of("car", "suv") == 0.8
        assert thresholds.minimum_of("dog", "dog") == 0.2

    def test_findings_below_their_phrase_minimum_fail(self) -> None:
        review_filter: ReviewFilter = ReviewFilter(
            ClassThresholds(0.3, {}, {"car": {"suv": 0.7}}), DuplicateSuppression()
        )
        findings: list[Finding] = [
            finding_of(0, "car", "car", 0.5, 0.0),
            finding_of(1, "car", "suv", 0.5, 50.0),
            finding_of(2, "car", "car", 0.2, 100.0),
        ]
        assert review_filter.passing_indices(findings) == frozenset({0})

    def test_suppression_keeps_the_best_box_of_each_class(self) -> None:
        review_filter: ReviewFilter = ReviewFilter(ClassThresholds(), DuplicateSuppression(True, 0.5))
        findings: list[Finding] = [
            finding_of(0, "car", "car", 0.6, 1.0),
            finding_of(1, "car", "suv", 0.9, 0.0),
            finding_of(2, "dog", "dog", 0.5, 0.0),
            finding_of(3, "car", "car", 0.4, 40.0),
        ]
        assert review_filter.passing_indices(findings) == frozenset({1, 2, 3})

    def test_class_overlap_replaces_the_default_one(self) -> None:
        review_filter: ReviewFilter = ReviewFilter(ClassThresholds(), DuplicateSuppression(True, 0.5, {"car": 0.95}))
        findings: list[Finding] = [finding_of(0, "car", "car", 0.6, 1.0), finding_of(1, "car", "car", 0.9, 0.0)]
        assert review_filter.passing_indices(findings) == frozenset({0, 1})

    def test_disabled_suppression_keeps_duplicates(self) -> None:
        review_filter: ReviewFilter = ReviewFilter(ClassThresholds(), DuplicateSuppression(False, 0.1))
        findings: list[Finding] = [finding_of(0, "car", "car", 0.6, 1.0), finding_of(1, "car", "car", 0.9, 0.0)]
        assert review_filter.passing_indices(findings) == frozenset({0, 1})

    def test_findings_below_the_minimum_do_not_suppress(self) -> None:
        review_filter: ReviewFilter = ReviewFilter(ClassThresholds(0.5), DuplicateSuppression(True, 0.5))
        findings: list[Finding] = [finding_of(0, "car", "car", 0.6, 1.0), finding_of(1, "car", "car", 0.3, 0.0)]
        assert review_filter.passing_indices(findings) == frozenset({0})


class TestReviewStores:
    """
    Phrase minimums and suppressions survive a restart per task.
    """

    def test_phrase_minimums_are_remembered(self, tmp_path: Path) -> None:
        store: ClassThresholdStore = ClassThresholdStore(tmp_path)
        thresholds: ClassThresholds = ClassThresholds(0.3, {"car": 0.4}, {"car": {"suv": 0.6}})
        saved: dict[RecognitionTask, ClassThresholds] = store.load()
        saved[RecognitionTask.DETECTION] = thresholds
        store.save(saved)
        assert store.load()[RecognitionTask.DETECTION] == thresholds

    def test_suppressions_are_remembered(self, tmp_path: Path) -> None:
        store: DuplicateSuppressionStore = DuplicateSuppressionStore(tmp_path)
        suppression: DuplicateSuppression = DuplicateSuppression(True, 0.45, {"car": 0.7})
        saved: dict[RecognitionTask, DuplicateSuppression] = store.load()
        saved[RecognitionTask.SEGMENTATION] = suppression
        store.save(saved)
        loaded: dict[RecognitionTask, DuplicateSuppression] = store.load()
        assert loaded[RecognitionTask.SEGMENTATION] == suppression
        assert loaded[RecognitionTask.DETECTION] == DuplicateSuppression()
