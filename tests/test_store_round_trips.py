import json
from pathlib import Path

import cv2
import numpy as np

from ovir_gui.media import FrameKey, InferenceMode
from ovir_gui.models import ComputeDevice, ComputePrecision, ModelProfile, ModelSelection, ProfileOption
from ovir_gui.prompting import PromptSignature, QueriedClass
from ovir_gui.recognition import FrameResult, ImageSize, InstanceMask, PixelBox, RecognitionTask, RecognizedInstance
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
)


class TestStoreRoundTrips:
    """
    Every store reads back what it wrote: the session, the class minimums, the duplicate suppression and the results
    archive with masks and rejections.
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
            frame_step=7,
            inference_mode=InferenceMode.ALL,
            is_auto_inference=False,
            selections={RecognitionTask.DETECTION: selection},
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
        store.save(Session(frame_step=3, inference_mode=InferenceMode.SHOWN))
        content: str = store.path.read_text("utf-8").replace('"shown"', '"everything"')
        _ = store.path.write_text(content, "utf-8")
        loaded: Session = store.load()
        assert loaded.inference_mode is None
        assert loaded.frame_step == 3

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
