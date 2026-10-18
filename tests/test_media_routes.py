from collections.abc import Iterator
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response

from ovir_gui.models import DeviceAvailability, ModelSelector, PresetCatalog
from ovir_gui.web import WebApplication
from ovir_gui.workspace import WorkspaceStores

ACCESS_TOKEN = "test-token"
FRAME_COUNT = 12
FRAME_WIDTH = 64
FRAME_HEIGHT = 48


class TestMediaRoutes:
    """
    Videos are served to the browser with range requests, and only when they are open.
    """

    @pytest.fixture
    def media_directory(self, tmp_path: Path) -> Path:
        directory: Path = tmp_path / "media"
        directory.mkdir()
        writer: cv2.VideoWriter = cv2.VideoWriter(
            str(directory / "clip.mp4"), cv2.VideoWriter.fourcc(*"mp4v"), 10.0, (FRAME_WIDTH, FRAME_HEIGHT)
        )
        for index in range(FRAME_COUNT):
            writer.write(np.full((FRAME_HEIGHT, FRAME_WIDTH, 3), index * 10, dtype=np.uint8))
        writer.release()
        _ = cv2.imwrite(str(directory / "still.png"), np.zeros((FRAME_HEIGHT, FRAME_WIDTH, 3), dtype=np.uint8))
        return directory

    @pytest.fixture
    def client(self, tmp_path: Path, media_directory: Path) -> Iterator[TestClient]:
        application: FastAPI = WebApplication(
            ModelSelector(PresetCatalog.from_packages(), DeviceAvailability.detect()),
            WorkspaceStores.in_directory(tmp_path / "data"),
            [media_directory],
            tmp_path,
            ACCESS_TOKEN,
            "ovir_gui_test",
        ).build()
        with TestClient(application) as client:
            _ = client.get(f"/?token={ACCESS_TOKEN}")
            yield client

    def test_video_is_served_in_ranges(self, client: TestClient, media_directory: Path) -> None:
        video_path: Path = media_directory / "clip.mp4"
        response: Response = client.get("/api/media/video", params={"path": str(video_path)}, headers={"Range": "bytes=0-99"})
        assert response.status_code == 206
        assert response.headers["content-type"] == "video/mp4"
        assert response.content == video_path.read_bytes()[:100]

    def test_image_is_not_served_as_video(self, client: TestClient, media_directory: Path) -> None:
        response: Response = client.get("/api/media/video", params={"path": str(media_directory / "still.png")})
        assert response.status_code == 400

    def test_closed_file_is_not_served(self, client: TestClient, tmp_path: Path) -> None:
        outside: Path = tmp_path / "outside.mp4"
        _ = outside.write_bytes(b"not open")
        response: Response = client.get("/api/media/video", params={"path": str(outside)})
        assert response.status_code == 400

    def test_unrecognized_video_has_no_frames(self, client: TestClient, media_directory: Path) -> None:
        video_path: Path = media_directory / "clip.mp4"
        response: Response = client.get("/api/video-frames", params={"path": str(video_path)})
        assert response.status_code == 200
        assert response.json() == {"path": str(video_path), "frames": []}

    def test_requests_without_token_are_refused(self, media_directory: Path, client: TestClient) -> None:
        client.cookies.clear()
        response: Response = client.get("/api/media/video", params={"path": str(media_directory / "clip.mp4")})
        assert response.status_code == 403
