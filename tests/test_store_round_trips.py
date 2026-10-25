import json
from pathlib import Path

import cv2
import numpy as np
from open_vocabulary_classification import (
    AggregationMethod,
    AggregationStep,
    AggregationTiming,
    AggregationUnit,
    PromptAggregation,
)

from ovir_gui.media import FrameKey, InferenceMode
from ovir_gui.models import (
    ComputeDevice,
    ComputePrecision,
    ModelProfile,
    ModelSelection,
    ProfileOption,
)
from ovir_gui.prompting import PromptSignature, QueriedClass
from ovir_gui.recognition import (
    ClassifierLogits,
    ClassScore,
    EmbeddingLogit,
    FrameResult,
    ImageSize,
    InstanceMask,
    LabelMode,
    PixelBox,
    RecognitionTask,
    RecognizedInstance,
)
from ovir_gui.results import ResultLibrary
from ovir_gui.review import ClassThresholds, DuplicateSuppression
from ovir_gui.storage import (
    ClassThresholdStore,
    DuplicateSuppressionStore,
    ResultsSnapshot,
    ResultsStore,
    Session,
    SessionMedia,
    SessionStore,
    SessionTaskSettings,
    TextTemplateStore,
)


class TestStoreRoundTrips:
    """
    Every store reads back what it wrote: the session, the class minimums, the duplicate suppression, the saved text
    templates and the results archive with masks, rejections and embedding logits.
    """

    def test_session_round_trip(self, tmp_path: Path) -> None:
        media_path: Path = tmp_path / "picture.png"
        selection: ModelSelection = ModelSelection(
            task=RecognitionTask.DETECTION,
            backend="owl_vit",
            preset_name="v2_base_patch16",
            device=ComputeDevice.CPU,
            precision=ComputePrecision.FLOAT32,
            confidence_threshold=0.25,
            nms_iou_threshold=0.5,
            batch_size=2,
        )
        video_path: Path = tmp_path / "clip.mp4"
        session: Session = Session(
            media={
                RecognitionTask.DETECTION: SessionMedia(paths=(media_path,), current_path=media_path),
                RecognitionTask.CLASSIFICATION: SessionMedia(
                    paths=(media_path, video_path), current_path=video_path, current_frame_index=6
                ),
            },
            task=RecognitionTask.DETECTION,
            task_settings={
                RecognitionTask.DETECTION: SessionTaskSettings(
                    frame_step=7, inference_mode=InferenceMode.ALL, is_auto_inference=False
                ),
                RecognitionTask.SEGMENTATION: SessionTaskSettings(frame_step=2),
            },
            selections={
                RecognitionTask.DETECTION: selection,
                RecognitionTask.CLASSIFICATION: ModelSelection(
                    task=RecognitionTask.CLASSIFICATION,
                    backend="clip",
                    preset_name="openai_vit_b16",
                    device=ComputeDevice.CPU,
                    precision=ComputePrecision.FLOAT32,
                    aggregation=PromptAggregation.of(
                        [
                            AggregationStep(
                                AggregationUnit.TEMPLATE_AND_PROMPT,
                                AggregationTiming.SIMILARITY,
                                AggregationMethod.LOGSUMEXP,
                            )
                        ]
                    ),
                ),
            },
        )
        store: SessionStore = SessionStore(tmp_path / "data")
        store.save(session)
        assert store.load() == session

    def test_media_list_of_earlier_sessions_goes_to_their_task(self, tmp_path: Path) -> None:
        store: SessionStore = SessionStore(tmp_path)
        media_path: Path = tmp_path / "picture.png"
        content: str = json.dumps(
            {"media": [str(media_path)], "current": str(media_path), "frame": None, "task": "segmentation"}
        )
        _ = store.path.write_text(content, "utf-8")
        loaded: Session = store.load()
        assert loaded.media == {
            RecognitionTask.SEGMENTATION: SessionMedia(paths=(media_path,), current_path=media_path),
        }

    def test_unknown_inference_mode_is_dropped(self, tmp_path: Path) -> None:
        store: SessionStore = SessionStore(tmp_path)
        store.save(
            Session(
                task_settings={
                    RecognitionTask.DETECTION: SessionTaskSettings(frame_step=3, inference_mode=InferenceMode.SHOWN)
                }
            )
        )
        content: str = store.path.read_text("utf-8").replace('"shown"', '"everything"')
        _ = store.path.write_text(content, "utf-8")
        loaded: Session = store.load()
        assert loaded.task_settings == {RecognitionTask.DETECTION: SessionTaskSettings(frame_step=3)}

    def test_shared_choices_of_earlier_sessions_go_to_every_task(self, tmp_path: Path) -> None:
        store: SessionStore = SessionStore(tmp_path)
        content: str = json.dumps({"frame_step": 5, "inference_mode": "all", "is_auto_inference": False})
        _ = store.path.write_text(content, "utf-8")
        loaded: Session = store.load()
        shared: SessionTaskSettings = SessionTaskSettings(
            frame_step=5, inference_mode=InferenceMode.ALL, is_auto_inference=False
        )
        assert loaded.task_settings == dict.fromkeys(RecognitionTask, shared)

    def test_class_thresholds_round_trip(self, tmp_path: Path) -> None:
        thresholds: dict[RecognitionTask, ClassThresholds] = {
            RecognitionTask.DETECTION: ClassThresholds(0.3, {"car": 0.4}, {"car": {"suv": 0.6}}),
            RecognitionTask.CLASSIFICATION: ClassThresholds(0.1),
        }
        ClassThresholdStore(tmp_path).save(thresholds)
        loaded: dict[RecognitionTask, ClassThresholds] = ClassThresholdStore(tmp_path).load()
        assert {task: loaded[task] for task in thresholds} == thresholds

    def test_duplicate_suppression_round_trip(self, tmp_path: Path) -> None:
        suppressions: dict[RecognitionTask, DuplicateSuppression] = {
            RecognitionTask.SEGMENTATION: DuplicateSuppression(True, 0.45, {"car": 0.7}),
        }
        DuplicateSuppressionStore(tmp_path).save(suppressions)
        loaded: dict[RecognitionTask, DuplicateSuppression] = DuplicateSuppressionStore(tmp_path).load()
        assert {task: loaded[task] for task in suppressions} == suppressions

    def test_text_templates_round_trip(self, tmp_path: Path) -> None:
        store: TextTemplateStore = TextTemplateStore(tmp_path / "data")
        assert store.load() is None
        templates: tuple[str, ...] = ("a photo of a {}.", "a {} on the street.")
        store.save(templates)
        assert store.load() == templates

    def test_results_archive_round_trip(self, tmp_path: Path) -> None:
        image_path: Path = tmp_path / "picture.png"
        _ = cv2.imwrite(str(image_path), np.zeros((16, 24, 3), dtype=np.uint8))
        dense: np.ndarray = np.zeros((16, 24), dtype=bool)
        dense[2:8, 3:9] = True
        mask: InstanceMask | None = InstanceMask.from_dense(dense)
        assert mask is not None
        profile: ModelProfile = ModelProfile(
            task=RecognitionTask.SEGMENTATION,
            backend="sam2",
            model_name="hiera_tiny",
            weights_path="weights",
            device="cpu",
            precision="fp32",
            options=(ProfileOption("NMS", "off"),),
        )
        result: FrameResult = FrameResult(
            task=RecognitionTask.SEGMENTATION,
            image_size=ImageSize(24, 16),
            instances=(
                RecognizedInstance("car", "car", 0.8, PixelBox(3.0, 2.0, 9.0, 8.0), mask),
                RecognizedInstance("car", "suv", 0.4, PixelBox(3.0, 2.0, 9.0, 8.0), mask),
            ),
        )
        signature: PromptSignature = PromptSignature(
            (QueriedClass(name="car", phrases=frozenset({"car", "suv"}), reference_boxes=frozenset()),)
        )
        library: ResultLibrary = ResultLibrary()
        library.record(profile, FrameKey(image_path), result, signature)
        library.catalog_of(profile).set_accepted(FrameKey(image_path), [1], False)
        store: ResultsStore = ResultsStore(tmp_path / "data")
        written: ResultsSnapshot = ResultsStore.snapshot(library)
        store.write(written)
        read_back: ResultsSnapshot = ResultsStore.snapshot(store.load())
        assert read_back.manifest == written.manifest
        assert len(read_back.mask_bits) == len(written.mask_bits)
        for read_bits, written_bits in zip(read_back.mask_bits, written.mask_bits, strict=True):
            assert np.array_equal(read_bits, written_bits)
        assert not store.path.with_name(f".{store.path.name}.partial").exists()

    def test_classifications_are_scored_again_from_their_stored_logits(self, tmp_path: Path) -> None:
        image_path: Path = tmp_path / "picture.png"
        _ = cv2.imwrite(str(image_path), np.zeros((16, 24, 3), dtype=np.uint8))
        profile: ModelProfile = ModelProfile(
            task=RecognitionTask.CLASSIFICATION,
            backend="clip",
            model_name="ViT-B-32",
            weights_path="weights",
            device="cpu",
            precision="fp32",
            options=(ProfileOption("Pooling", "cls"),),
        )
        logits: ClassifierLogits = ClassifierLogits(
            class_names=("dog", "cat"),
            prompt_labels=("dog", "cat"),
            embeddings=(
                EmbeddingLogit(0, 0, "{}", 0.0),
                EmbeddingLogit(0, 0, "a photo of a {}.", 4.0),
                EmbeddingLogit(1, None, None, 3.0),
            ),
            logit_scale=100.0,
            logit_bias=0.0,
        )
        result: FrameResult = FrameResult(
            task=RecognitionTask.CLASSIFICATION,
            image_size=ImageSize(24, 16),
            class_scores=(ClassScore("dog", 0.5, 0.0, "dog", 0.0, "{}"), ClassScore("cat", 0.5, 0.0, "cat", 0.0, "{}")),
            native_label_mode=LabelMode.SINGLE_LABEL,
            embedding_logits=logits,
        )
        signature: PromptSignature = PromptSignature(
            (
                QueriedClass(name="dog", phrases=frozenset({"dog"}), reference_boxes=frozenset()),
                QueriedClass(name="cat", phrases=frozenset({"cat"}), reference_boxes=frozenset()),
            )
        )
        library: ResultLibrary = ResultLibrary()
        library.apply_aggregation(self._similarity_aggregation(AggregationMethod.MAX))
        library.record(profile, FrameKey(image_path), result, signature)
        library.catalog_of(profile).set_accepted(FrameKey(image_path), [1], False)
        store: ResultsStore = ResultsStore(tmp_path / "data")
        store.write(ResultsStore.snapshot(library))
        read_back: ResultLibrary = store.load()
        read_back.apply_aggregation(self._similarity_aggregation(AggregationMethod.MIN))
        stored = read_back.catalog_of(profile).stored_of(FrameKey(image_path))
        assert stored is not None
        assert stored.rejected_indices == frozenset({1})
        dog, cat = stored.result.class_scores
        assert (dog.logit, dog.matched_template, cat.logit) == (0.0, "a photo of a {}.", 3.0)
        assert (cat.matched_prompt, cat.matched_template) == (None, None)
        assert cat.score > dog.score

    @staticmethod
    def _similarity_aggregation(method: AggregationMethod) -> PromptAggregation:
        return PromptAggregation.of(
            [
                AggregationStep(AggregationUnit.TEMPLATE, AggregationTiming.SIMILARITY, method),
                AggregationStep(AggregationUnit.PROMPT, AggregationTiming.SIMILARITY, AggregationMethod.MAX),
            ]
        )
