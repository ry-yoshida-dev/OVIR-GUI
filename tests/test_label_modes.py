import json
from pathlib import Path

import cv2
import numpy as np

from ovir_gui.analysis import ProfileComparison
from ovir_gui.media import FrameKey
from ovir_gui.models import ModelProfile
from ovir_gui.prompting import PromptSignature, QueriedClass
from ovir_gui.recognition import ClassScore, FrameResult, ImageSize, LabelMode, RecognitionTask
from ovir_gui.results import ResultCatalog, ResultLibrary, StoredResult
from ovir_gui.review import ClassThresholds, DuplicateSuppression, ReviewFilter
from ovir_gui.storage import JsonValue, LabelModeStore, ResultsSnapshot, ResultsStore
from ovir_gui.storage.results_manifest_reader import ResultsManifestReader

CLASS_NAMES: tuple[str, ...] = ("cat", "dog", "bird")


def classification_of(scores: tuple[float, ...], native_label_mode: LabelMode) -> FrameResult:
    return FrameResult(
        task=RecognitionTask.CLASSIFICATION,
        image_size=ImageSize(24, 16),
        class_scores=tuple(
            ClassScore(
                class_name=name, score=score, logit=0.0, matched_prompt=name, similarity=None, matched_template=None
            )
            for name, score in zip(CLASS_NAMES, scores, strict=True)
        ),
        native_label_mode=native_label_mode,
    )


def filter_of(label_mode: LabelMode | None, minimum: float = 0.5) -> ReviewFilter:
    return ReviewFilter(ClassThresholds(minimum), DuplicateSuppression(), label_mode)


def classification_profile(backend: str) -> ModelProfile:
    return ModelProfile(
        task=RecognitionTask.CLASSIFICATION,
        backend=backend,
        model_name=backend,
        weights_path="weights",
        device="cpu",
        precision="fp32",
        options=(),
    )


class TestLabelModes:
    """
    A classification lists its best class in single-label mode and every class in multi-label mode; until a mode is
    chosen, each result follows the scores of its model.
    """

    def test_multi_label_keeps_every_class_reaching_its_minimum(self) -> None:
        result: FrameResult = classification_of((0.2, 0.9, 0.6), LabelMode.MULTI_LABEL)
        review_filter: ReviewFilter = filter_of(None)
        assert [finding.index for finding in review_filter.findings_of(result)] == [1, 2, 0]
        assert review_filter.passing_indices_of(result) == frozenset({1, 2})

    def test_single_label_keeps_only_the_best_class(self) -> None:
        result: FrameResult = classification_of((0.2, 0.9, 0.6), LabelMode.MULTI_LABEL)
        review_filter: ReviewFilter = filter_of(LabelMode.SINGLE_LABEL)
        assert [finding.index for finding in review_filter.findings_of(result)] == [1]
        assert review_filter.passing_indices_of(result) == frozenset({1})

    def test_unchosen_mode_follows_softmax_scores(self) -> None:
        result: FrameResult = classification_of((0.2, 0.5, 0.3), LabelMode.SINGLE_LABEL)
        assert filter_of(None).label_mode_of(result) is LabelMode.SINGLE_LABEL
        assert filter_of(LabelMode.MULTI_LABEL).label_mode_of(result) is LabelMode.MULTI_LABEL

    def test_rejection_is_kept_by_class_position(self) -> None:
        result: FrameResult = classification_of((0.2, 0.9, 0.6), LabelMode.MULTI_LABEL)
        stored: StoredResult = StoredResult(result=result, signature=PromptSignature(())).with_accepted(
            frozenset({2}), False
        )
        assert stored.kept_indices(filter_of(LabelMode.MULTI_LABEL)) == frozenset({1})
        assert stored.kept_indices(filter_of(LabelMode.SINGLE_LABEL)) == frozenset({1})

    def test_comparison_matches_each_kept_class(self) -> None:
        frame_key: FrameKey = FrameKey(Path("picture.png"))
        signature: PromptSignature = PromptSignature(())
        shown: ResultCatalog = ResultCatalog()
        compared: ResultCatalog = ResultCatalog()
        shown.record(frame_key, classification_of((0.2, 0.9, 0.6), LabelMode.MULTI_LABEL), signature)
        compared.record(frame_key, classification_of((0.7, 0.8, 0.1), LabelMode.MULTI_LABEL), signature)
        comparison: ProfileComparison = ProfileComparison.between(
            shown, compared, [frame_key], CLASS_NAMES, filter_of(None)
        )
        assert comparison.pictures[0].shown_count == 2
        assert comparison.pictures[0].compared_count == 2
        assert comparison.pictures[0].matched_count == 1

    def test_native_label_mode_is_read_from_the_backend(self, tmp_path: Path) -> None:
        image_path: Path = tmp_path / "picture.png"
        _ = cv2.imwrite(str(image_path), np.zeros((16, 24, 3), dtype=np.uint8))
        library: ResultLibrary = ResultLibrary()
        for backend, native_label_mode in (("clip", LabelMode.SINGLE_LABEL), ("siglip", LabelMode.MULTI_LABEL)):
            library.record(
                classification_profile(backend),
                FrameKey(image_path),
                classification_of((0.2, 0.9, 0.6), native_label_mode),
                PromptSignature((QueriedClass(name="cat", phrases=frozenset({"cat"}), reference_boxes=frozenset()),)),
            )
        store: ResultsStore = ResultsStore(tmp_path / "data")
        store.write(store.snapshot(library))
        read_back: ResultLibrary = store.load()
        for backend, native_label_mode in (("clip", LabelMode.SINGLE_LABEL), ("siglip", LabelMode.MULTI_LABEL)):
            stored: StoredResult | None = read_back.catalog_of(classification_profile(backend)).stored_of(
                FrameKey(image_path)
            )
            assert stored is not None
            assert stored.result.native_label_mode is native_label_mode

    def test_version_one_rejection_moves_to_the_best_class(self, tmp_path: Path) -> None:
        image_path: Path = tmp_path / "picture.png"
        _ = cv2.imwrite(str(image_path), np.zeros((16, 24, 3), dtype=np.uint8))
        profile: ModelProfile = classification_profile("siglip")
        library: ResultLibrary = ResultLibrary()
        library.record(
            profile,
            FrameKey(image_path),
            classification_of((0.2, 0.9, 0.6), LabelMode.MULTI_LABEL),
            PromptSignature(()),
        )
        snapshot: ResultsSnapshot = ResultsStore(tmp_path / "data").snapshot(library)
        manifest: dict[str, JsonValue] = json.loads(json.dumps(snapshot.manifest))
        manifest["version"] = 1
        profiles: JsonValue = manifest["profiles"]
        assert isinstance(profiles, list)
        profile_entry: JsonValue = profiles[0]
        assert isinstance(profile_entry, dict)
        frames: JsonValue = profile_entry["frames"]
        assert isinstance(frames, list)
        frame_entry: JsonValue = frames[0]
        assert isinstance(frame_entry, dict)
        frame_entry["rejected"] = [0]
        read_back: ResultLibrary = ResultsManifestReader(snapshot.mask_bits).read(manifest).library
        stored: StoredResult | None = read_back.catalog_of(profile).stored_of(FrameKey(image_path))
        assert stored is not None
        assert stored.rejected_indices == frozenset({1})

    def test_store_remembers_the_choice(self, tmp_path: Path) -> None:
        store: LabelModeStore = LabelModeStore(tmp_path)
        assert store.load() is None
        store.save(LabelMode.MULTI_LABEL)
        assert LabelModeStore(tmp_path).load() is LabelMode.MULTI_LABEL
