from dataclasses import replace
from pathlib import Path

import cv2
import numpy as np
import pytest

from ovir_gui.media import FrameKey, MediaItem, VideoSampling
from ovir_gui.models import ModelProfile
from ovir_gui.recognition import RecognitionTask
from ovir_gui.workspace import BackgroundPlanner, InferenceMode

FRAME_COUNT = 6
FRAME_WIDTH = 32
FRAME_HEIGHT = 24


class TestBackgroundPlanner:
    """
    Background recognition covers the shown picture, or every picture with the shown media first.
    """

    @pytest.fixture
    def profile(self) -> ModelProfile:
        return ModelProfile(
            task=RecognitionTask.DETECTION,
            backend="test",
            model_name="test",
            weights_path="test.pt",
            device="cpu",
            precision="float32",
            options=(),
        )

    @pytest.fixture
    def video(self, tmp_path: Path) -> MediaItem:
        path: Path = tmp_path / "clip.mp4"
        writer: cv2.VideoWriter = cv2.VideoWriter(
            str(path), cv2.VideoWriter.fourcc(*"mp4v"), 10.0, (FRAME_WIDTH, FRAME_HEIGHT)
        )
        for _ in range(FRAME_COUNT):
            writer.write(np.zeros((FRAME_HEIGHT, FRAME_WIDTH, 3), dtype=np.uint8))
        writer.release()
        return MediaItem.open(path)

    @pytest.fixture
    def images(self, tmp_path: Path) -> tuple[MediaItem, MediaItem]:
        return MediaItem.image(tmp_path / "first.png"), MediaItem.image(tmp_path / "second.png")

    def test_shown_mode_takes_sampled_frame_at_or_before_shown_frame(
        self, profile: ModelProfile, video: MediaItem
    ) -> None:
        keys: tuple[FrameKey, ...] = BackgroundPlanner().next_keys(
            profile, InferenceMode.SHOWN, video.key_at(3), [video], every_second_frame, lambda _: False
        )
        assert keys == (video.key_at(2),)

    def test_shown_mode_ignores_other_media(
        self, profile: ModelProfile, video: MediaItem, images: tuple[MediaItem, MediaItem]
    ) -> None:
        first, _ = images
        keys: tuple[FrameKey, ...] = BackgroundPlanner().next_keys(
            profile, InferenceMode.SHOWN, first.key_at(None), [first, video], every_second_frame, lambda _: True
        )
        assert keys == ()

    def test_all_mode_starts_at_shown_frame(self, profile: ModelProfile, video: MediaItem) -> None:
        keys: tuple[FrameKey, ...] = BackgroundPlanner().next_keys(
            profile, InferenceMode.ALL, video.key_at(2), [video], every_second_frame, lambda _: False
        )
        assert [key.frame_index for key in keys] == [2, 4, 0]

    def test_all_mode_covers_videos_in_list_order(
        self, profile: ModelProfile, video: MediaItem, images: tuple[MediaItem, MediaItem]
    ) -> None:
        first, second = images
        keys: tuple[FrameKey, ...] = BackgroundPlanner().next_keys(
            profile,
            InferenceMode.ALL,
            first.key_at(None),
            [first, video, second],
            every_second_frame,
            lambda key: key == first.key_at(None) or key == video.key_at(0),
        )
        assert keys == (video.key_at(2), video.key_at(4))

    def test_sequential_model_skips_videos(
        self, profile: ModelProfile, video: MediaItem, images: tuple[MediaItem, MediaItem]
    ) -> None:
        first, _ = images
        sequential: ModelProfile = replace(profile, is_sequential=True)
        keys: tuple[FrameKey, ...] = BackgroundPlanner().next_keys(
            sequential, InferenceMode.ALL, video.key_at(0), [video, first], every_second_frame, lambda _: False
        )
        assert keys == (first.key_at(None),)


def every_second_frame(item: MediaItem) -> tuple[FrameKey, ...]:
    return item.frame_keys(VideoSampling(2))
