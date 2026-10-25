from pathlib import Path
from typing import ClassVar

import cv2
import numpy as np
import pytest

from ovir_gui.media import FrameKey
from ovir_gui.models import ModelProfile, StreamPosition
from ovir_gui.prompting import (
    ExemplarBox,
    LabeledPrompt,
    ObjectMark,
    PicturePromptBoard,
    PicturePrompts,
    PromptChange,
    PromptClass,
    PromptSignature,
    QueriedClass,
    QueryKind,
)
from ovir_gui.recognition import FrameResult, ImageSize, InstanceMask, RecognitionTask, RecognizedInstance
from ovir_gui.results import ResultLibrary
from ovir_gui.storage import PicturePromptStore, ResultsStore

IMAGE_WIDTH = 32
IMAGE_HEIGHT = 24


class TestPicturePromptBoard:
    """
    Drawings follow their class, objects keep one class per media file, and object ids are numbered per file.
    """

    def test_object_ids_are_numbered_per_file(self) -> None:
        board: PicturePromptBoard = PicturePromptBoard()
        video: Path = Path("/media/clip.mp4")
        board.set_mark(ObjectMark(FrameKey(video, 0), 1, "car", positive_points=((1.0, 2.0),)))
        board.set_mark(ObjectMark(FrameKey(video, 5), 4, "car", positive_points=((1.0, 2.0),)))
        assert board.next_object_id(video) == 5
        assert board.next_object_id(Path("/media/other.mp4")) == 1

    def test_marking_an_object_again_relabels_it_on_every_frame(self) -> None:
        board: PicturePromptBoard = PicturePromptBoard()
        video: Path = Path("/media/clip.mp4")
        board.set_mark(ObjectMark(FrameKey(video, 0), 1, "car", positive_points=((1.0, 2.0),)))
        board.set_mark(ObjectMark(FrameKey(video, 9), 1, "truck", box=(0.0, 0.0, 4.0, 4.0)))
        assert {mark.class_name for mark in board.prompts.of_media(video).marks} == {"truck"}

    def test_drawings_follow_renamed_and_removed_classes(self) -> None:
        board: PicturePromptBoard = PicturePromptBoard()
        image: FrameKey = FrameKey(Path("/media/a.jpg"))
        board.add_exemplar(ExemplarBox(image, "car", 0.0, 0.0, 5.0, 5.0))
        board.set_mark(ObjectMark(image, 1, "dog", positive_points=((1.0, 1.0),)))
        board.rename_class("car", "vehicle")
        board.retain_classes(["vehicle"])
        prompts: PicturePrompts = board.prompts
        assert [box.class_name for box in prompts.exemplars] == ["vehicle"]
        assert prompts.marks == ()

    def test_exemplar_is_removed_by_its_position_on_the_picture(self) -> None:
        board: PicturePromptBoard = PicturePromptBoard()
        first: FrameKey = FrameKey(Path("/media/a.jpg"))
        second: FrameKey = FrameKey(Path("/media/b.jpg"))
        board.add_exemplar(ExemplarBox(first, "car", 0.0, 0.0, 5.0, 5.0))
        board.add_exemplar(ExemplarBox(second, "car", 0.0, 0.0, 6.0, 6.0))
        board.add_exemplar(ExemplarBox(first, "car", 1.0, 1.0, 7.0, 7.0, is_positive=False))
        board.remove_exemplar(first, 1)
        assert [box.xyxy for box in board.prompts.of(first).exemplars] == [(0.0, 0.0, 5.0, 5.0)]
        with pytest.raises(IndexError):
            board.remove_exemplar(second, 1)

    def test_mark_needs_a_positive_point_or_a_box(self) -> None:
        with pytest.raises(ValueError):
            ObjectMark(FrameKey(Path("/media/a.jpg")), 1, "car", negative_points=((1.0, 1.0),))


class TestDrawnSignature:
    """
    Results remember the drawings they depend on, so editing a drawing outdates exactly the affected pictures.
    """

    VIDEO: ClassVar[Path] = Path("/media/clip.mp4")

    @staticmethod
    def class_signature() -> PromptSignature:
        return PromptSignature(
            (
                QueriedClass(name="car", phrases=frozenset({"car"}), reference_boxes=frozenset()),
                QueriedClass(name="dog", phrases=frozenset(), reference_boxes=frozenset()),
            )
        )

    def prompt(
        self, picture_prompts: PicturePrompts, kinds: frozenset[QueryKind], is_sequential: bool
    ) -> LabeledPrompt:
        return LabeledPrompt(
            classes=(),
            class_signature=self.class_signature(),
            query_kinds=kinds,
            picture_prompts=picture_prompts,
            is_sequential=is_sequential,
        )

    def test_mark_models_ignore_phrases(self) -> None:
        mark: ObjectMark = ObjectMark(FrameKey(self.VIDEO, 3), 1, "dog", positive_points=((1.0, 1.0),))
        signature: PromptSignature = self.prompt(
            PicturePrompts(marks=(mark,)), frozenset({QueryKind.MARK}), is_sequential=False
        ).signature_of(FrameKey(self.VIDEO, 3))
        assert [queried.name for queried in signature.classes] == ["dog"]
        assert signature.classes[0].object_marks == frozenset({mark})

    def test_tracker_frames_depend_on_every_mark_of_the_video(self) -> None:
        early: ObjectMark = ObjectMark(FrameKey(self.VIDEO, 0), 1, "dog", positive_points=((1.0, 1.0),))
        late: ObjectMark = ObjectMark(FrameKey(self.VIDEO, 9), 1, "dog", positive_points=((2.0, 2.0),))
        before: PicturePrompts = PicturePrompts(marks=(early,))
        after: PicturePrompts = PicturePrompts(marks=(early, late))
        kinds: frozenset[QueryKind] = frozenset({QueryKind.MARK})
        frame: FrameKey = FrameKey(self.VIDEO, 4)
        tracked: PromptChange = PromptChange.between(
            self.prompt(before, kinds, is_sequential=True).signature_of(frame),
            self.prompt(after, kinds, is_sequential=True).signature_of(frame),
        )
        segmented: PromptChange = PromptChange.between(
            self.prompt(before, kinds, is_sequential=False).signature_of(frame),
            self.prompt(after, kinds, is_sequential=False).signature_of(frame),
        )
        assert tracked.edited_class_names == ("dog",)
        assert segmented.is_unchanged

    def test_exemplar_only_class_is_queried_where_it_has_a_positive_box(self) -> None:
        image: FrameKey = FrameKey(Path("/media/a.jpg"))
        other: FrameKey = FrameKey(Path("/media/b.jpg"))
        prompts: PicturePrompts = PicturePrompts(exemplars=(ExemplarBox(image, "dog", 0.0, 0.0, 5.0, 5.0),))
        prompt: LabeledPrompt = self.prompt(prompts, frozenset({QueryKind.TEXT, QueryKind.EXEMPLAR}), False)
        assert [queried.name for queried in prompt.signature_of(image).classes] == ["car", "dog"]
        assert [queried.name for queried in prompt.signature_of(other).classes] == ["car"]

    def test_drawings_are_dropped_for_models_not_reading_them(self) -> None:
        image: FrameKey = FrameKey(Path("/media/a.jpg"))
        prompts: PicturePrompts = PicturePrompts(
            exemplars=(ExemplarBox(image, "car", 0.0, 0.0, 5.0, 5.0),),
            marks=(ObjectMark(image, 1, "car", box=(0.0, 0.0, 3.0, 3.0)),),
        )
        signature: PromptSignature = self.prompt(prompts, frozenset({QueryKind.TEXT}), False).signature_of(image)
        assert signature == self.class_signature().for_query_kinds(frozenset({QueryKind.TEXT}))

    def test_exemplar_only_class_labels_its_query(self) -> None:
        prompt_class: PromptClass = PromptClass(name="dog", phrases=(), visual_examples=(), is_exemplar_queried=True)
        assert prompt_class.prompt_labels == (PromptClass.EXEMPLAR_LABEL,)
        with pytest.raises(ValueError):
            PromptClass(name="dog", phrases=(), visual_examples=())


class TestStreamPosition:
    """
    A tracking stream continues only with later frames of the same video and run.
    """

    def test_stream_continues_with_later_frames_of_the_same_run(self) -> None:
        prompt: LabeledPrompt = LabeledPrompt(classes=(), class_signature=PromptSignature(()), query_kinds=frozenset())
        other: LabeledPrompt = LabeledPrompt(classes=(), class_signature=PromptSignature(()), query_kinds=frozenset())
        video: Path = Path("/media/clip.mp4")
        position: StreamPosition = StreamPosition()
        position.advance(FrameKey(video, 4), prompt)
        assert position.is_continued_by(FrameKey(video, 8), prompt)
        assert not position.is_continued_by(FrameKey(video, 4), prompt)
        assert not position.is_continued_by(FrameKey(video, 8), other)
        assert not position.is_continued_by(FrameKey(Path("/media/a.jpg")), prompt)


class TestDrawingPersistence:
    """
    Drawings survive a restart, both on their own and inside the signatures of stored results.
    """

    @pytest.fixture
    def image_path(self, tmp_path: Path) -> Path:
        path: Path = tmp_path / "still.png"
        _ = cv2.imwrite(str(path), np.zeros((IMAGE_HEIGHT, IMAGE_WIDTH, 3), dtype=np.uint8))
        return path

    def test_drawings_are_remembered(self, tmp_path: Path, image_path: Path) -> None:
        store: PicturePromptStore = PicturePromptStore(tmp_path / "data")
        prompts: PicturePrompts = PicturePrompts(
            exemplars=(ExemplarBox(FrameKey(image_path), "car", 1.0, 2.0, 10.0, 12.0, is_positive=False),),
            marks=(
                ObjectMark(
                    FrameKey(image_path, None),
                    2,
                    "dog",
                    positive_points=((3.0, 4.0),),
                    negative_points=((5.0, 6.0),),
                    box=(1.0, 1.0, 9.0, 9.0),
                ),
            ),
        )
        store.save({RecognitionTask.SEGMENTATION: prompts})
        loaded: dict[RecognitionTask, PicturePrompts] = store.load()
        assert loaded[RecognitionTask.SEGMENTATION].exemplars == prompts.exemplars
        assert loaded[RecognitionTask.SEGMENTATION].marks == prompts.marks
        assert not loaded[RecognitionTask.DETECTION].exemplars
        assert not loaded[RecognitionTask.DETECTION].marks

    def test_result_signatures_keep_their_marks(self, tmp_path: Path, image_path: Path) -> None:
        frame_key: FrameKey = FrameKey(image_path)
        mark: ObjectMark = ObjectMark(frame_key, 1, "dog", positive_points=((3.0, 4.0),))
        profile: ModelProfile = ModelProfile(
            task=RecognitionTask.SEGMENTATION,
            backend="promptable/sam2",
            model_name="hiera_tiny",
            weights_path="facebook/sam2.1-hiera-tiny",
            device="cpu",
            precision="fp32",
            options=(),
            query_kinds=frozenset({QueryKind.MARK}),
            is_sequential=False,
        )
        dense: np.ndarray = np.zeros((IMAGE_HEIGHT, IMAGE_WIDTH), dtype=np.bool_)
        dense[2:6, 3:9] = True
        instance_mask: InstanceMask | None = InstanceMask.from_dense(dense)
        assert instance_mask is not None
        result: FrameResult = FrameResult(
            task=RecognitionTask.SEGMENTATION,
            image_size=ImageSize(width=IMAGE_WIDTH, height=IMAGE_HEIGHT),
            instances=(
                RecognizedInstance(
                    class_name="dog",
                    matched_prompt=mark.label,
                    confidence=0.9,
                    box=instance_mask.box,
                    mask=instance_mask,
                ),
            ),
        )
        prompt: LabeledPrompt = LabeledPrompt(
            classes=(),
            class_signature=PromptSignature(()),
            query_kinds=profile.query_kinds,
            picture_prompts=PicturePrompts(marks=(mark,)),
        )
        library: ResultLibrary = ResultLibrary()
        library.record(profile, frame_key, result, prompt.signature_of(frame_key))
        store: ResultsStore = ResultsStore(tmp_path / "data")
        store.write(store.snapshot(library))
        restored: ResultLibrary = store.load()
        restored_profile: ModelProfile = restored.profiles[0]
        assert restored_profile.is_sequential is False
        change: PromptChange | None = restored.prompt_change_of(
            restored_profile, frame_key, prompt.signature_of(frame_key)
        )
        assert change is not None and change.is_unchanged
