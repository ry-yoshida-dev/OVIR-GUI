from pathlib import Path

import cv2
import numpy as np
import pytest

from ovir_gui.media import FrameKey, MediaItem
from ovir_gui.models import ModelProfile
from ovir_gui.recognition import RecognitionTask
from ovir_gui.workspace import BackgroundPlanner, BackgroundScope

FRAME_COUNT = 6
FRAME_WIDTH = 32
FRAME_HEIGHT = 24


class TestBackgroundPlanner:
    """
    Background recognition covers images only; videos wait until the user runs them.
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

    def test_shown_video_is_not_recognized(self, profile: ModelProfile, video: MediaItem) -> None:
        keys: tuple[FrameKey, ...] = BackgroundPlanner().next_keys(
            profile, BackgroundScope.SHOWN, video.key_at(0), [video], lambda _: False
        )
        assert keys == ()

    def test_all_scope_skips_videos(
        self, profile: ModelProfile, video: MediaItem, images: tuple[MediaItem, MediaItem]
    ) -> None:
        first, second = images
        keys: tuple[FrameKey, ...] = BackgroundPlanner().next_keys(
            profile,
            BackgroundScope.ALL,
            video.key_at(0),
            [first, video, second],
            lambda key: key == second.key_at(None),
        )
        assert keys == (first.key_at(None),)
