import csv
import json
import time
from collections.abc import Iterator
from pathlib import Path
from typing import cast

import cv2
import numpy as np
import pytest
from fake_recognizer_session import FakeRecognizerSession
from fastapi import FastAPI
from fastapi.testclient import TestClient
from golden_snapshot import GoldenSnapshot
from PIL import Image

from ovir_gui.media import VideoSampling
from ovir_gui.models import DeviceAvailability, ModelSelector, PresetCatalog
from ovir_gui.web import EmbeddingPolicy, WebApplication
from ovir_gui.workspace import WorkspaceStores

ACCESS_TOKEN = "test-token"
FRAME_COUNT = 12
FRAME_STEP = 4
TIMEOUT_SECONDS = 30.0
JsonDict = dict[str, object]


class TestWorkspaceFlow:
    """
    Characterization of the workspace through the web API with a fake recognizer: recognized media, review,
    comparison, export and restart produce the payloads recorded under ``tests/golden``.
    """

    @pytest.fixture
    def media_directory(self, tmp_path: Path) -> Path:
        directory: Path = tmp_path / "media"
        directory.mkdir()
        _ = cv2.imwrite(str(directory / "a_first.png"), np.full((48, 64, 3), 40, dtype=np.uint8))
        _ = cv2.imwrite(str(directory / "b_second.png"), np.full((40, 80, 3), 90, dtype=np.uint8))
        writer: cv2.VideoWriter = cv2.VideoWriter(
            str(directory / "c_clip.mp4"), cv2.VideoWriter.fourcc(*"mp4v"), 10.0, (64, 48)
        )
        for index in range(FRAME_COUNT):
            writer.write(np.full((48, 64, 3), index * 10, dtype=np.uint8))
        writer.release()
        return directory

    @pytest.fixture
    def golden(self, tmp_path: Path) -> GoldenSnapshot:
        return GoldenSnapshot(tmp_path)

    @pytest.fixture
    def client(self, tmp_path: Path, media_directory: Path) -> Iterator[TestClient]:
        with self._client_of(tmp_path, [media_directory]) as client:
            self._recognize_everything(client)
            yield client

    def test_recognized_payloads(self, client: TestClient, media_directory: Path, golden: GoldenSnapshot) -> None:
        self._assert_payloads(client, media_directory, golden, "recognized")

    def test_reviewed_payloads(self, client: TestClient, media_directory: Path, golden: GoldenSnapshot) -> None:
        assert client.put(
            "/api/thresholds",
            json={"default_minimum": 0.6, "class_minimums": {"dog": 0.4}, "prompt_minimums": {}},
        ).is_success
        assert client.put(
            "/api/suppression",
            json={"is_enabled": True, "overlap_threshold": 0.5, "class_overlap_thresholds": {}},
        ).is_success
        image_path: str = str(media_directory / "a_first.png")
        assert client.post(
            "/api/findings/acceptance",
            json={"findings": [{"path": image_path, "frame": None, "indices": [1]}], "is_accepted": False},
        ).is_success
        self._assert_payloads(client, media_directory, golden, "reviewed")

    def test_comparison(self, client: TestClient, golden: GoldenSnapshot) -> None:
        first_key: object = self._state(client)["shown_profile_key"]
        assert client.put("/api/model/preset", json={"backend": "owl_vit", "preset_name": "v2_base_patch16"}).is_success
        assert client.put("/api/classes/text", json={"text": "person\ncar"}).is_success
        self._wait_idle(client)
        assert client.put("/api/comparison", json={"key": first_key}).is_success
        golden.assert_matches("comparison_statistics", client.get("/api/statistics").json())
        golden.assert_matches("comparison_state", self._state(client))

    def test_edited_classes_outdate_results(self, client: TestClient, golden: GoldenSnapshot) -> None:
        assert client.put("/api/inference", json={"mode": "all", "is_auto": False}).is_success
        assert client.put("/api/classes/text", json={"text": "person\ncat"}).is_success
        golden.assert_matches("outdated_state", self._state(client))
        golden.assert_matches("outdated_results", client.get("/api/results").json())
        reply: JsonDict = client.post("/api/update-outdated", json={"is_skipping_approved": False}).json()
        assert reply["status"] == "done"
        self._wait_idle(client)
        golden.assert_matches("updated_state", self._state(client))

    def test_csv_export(self, client: TestClient, tmp_path: Path, golden: GoldenSnapshot) -> None:
        golden.assert_matches("export_plan", client.get("/api/export/plan", params={"media": "image"}).json())
        written: JsonDict = self._export(client, tmp_path / "export_csv", "csv", self._listed_images(client))
        golden.assert_matches("export_csv", written)

    def test_coco_export(self, client: TestClient, tmp_path: Path, golden: GoldenSnapshot) -> None:
        written: JsonDict = self._export(client, tmp_path / "export_coco", "coco", self._listed_images(client))
        golden.assert_matches("export_coco", written)

    def test_video_export(self, client: TestClient, tmp_path: Path) -> None:
        plan: JsonDict = client.get("/api/export/plan", params={"media": "video"}).json()
        assert plan["picture_count"] == FRAME_COUNT // FRAME_STEP
        assert plan["pending_count"] == 0
        written: JsonDict = self._export(client, tmp_path / "export_video", "csv", {"media": "video"})
        last_export: object = written["last_export"]
        assert isinstance(last_export, dict)
        assert last_export["picture_count"] == FRAME_COUNT // FRAME_STEP

    def test_image_export_needs_listed_pictures(self, client: TestClient, tmp_path: Path) -> None:
        body: JsonDict = {"export_format": "csv", "output_directory": str(tmp_path / "unlisted"), "media": "image"}
        assert client.post("/api/export", json=body).status_code == 400

    def test_cropped_objects_export(self, client: TestClient, tmp_path: Path, golden: GoldenSnapshot) -> None:
        directory: Path = tmp_path / "export_crops"
        written: JsonDict = self._export(
            client,
            directory,
            "cropped_objects",
            {"crop_image_format": "png", "crop_margin_percent": 25.0, **self._listed_images(client)},
        )
        golden.assert_matches("export_cropped_objects", written)
        with (directory / "crops.csv").open(encoding="utf-8", newline="") as table_file:
            rows: list[dict[str, str]] = list(csv.DictReader(table_file))
        assert rows
        for row in rows:
            with Image.open(directory / row["crop"]) as crop:
                assert crop.format == "PNG"
                assert crop.size == (
                    int(row["crop_x_max"]) - int(row["crop_x_min"]),
                    int(row["crop_y_max"]) - int(row["crop_y_min"]),
                )

    def test_label_preview(self, client: TestClient, media_directory: Path) -> None:
        image_path: str = str(media_directory / "b_second.png")
        assert client.post("/api/media/show", json={"path": image_path, "frame": None}).is_success
        listed: JsonDict = self._listed_images(client)
        coco: JsonDict = client.post("/api/export/preview", json={"export_format": "coco", **listed}).json()
        assert coco["file_name"] == "annotations.json"
        assert coco["is_shown_picture_only"] is False
        coco_text: object = coco["text"]
        assert isinstance(coco_text, str)
        document: object = json.loads(coco_text)
        assert isinstance(document, dict)
        assert [category["name"] for category in document["categories"]] == ["person", "car", "dog"]
        assert len(document["images"]) == 2
        yolo: JsonDict = client.post("/api/export/preview", json={"export_format": "yolo", **listed}).json()
        assert yolo["file_name"] == "b_second.txt"
        assert yolo["is_shown_picture_only"] is True
        yolo_text: object = yolo["text"]
        assert isinstance(yolo_text, str)
        assert len(yolo_text.splitlines()) == 4
        confident: JsonDict = self._listed_images(client, minimum_confidence=0.8)
        crops: JsonDict = client.post(
            "/api/export/preview", json={"export_format": "cropped_objects", **confident}
        ).json()
        assert crops["file_name"] == "crops.csv"
        crops_text: object = crops["text"]
        assert isinstance(crops_text, str)
        assert [row.split(",")[0] for row in crops_text.splitlines()[1:]] == ["crops/person/b_second_001.jpg"]

    def test_listed_image_export(self, client: TestClient, tmp_path: Path, media_directory: Path) -> None:
        image_path: str = str(media_directory / "a_first.png")
        written: JsonDict = self._export(
            client,
            tmp_path / "export_listed",
            "csv",
            {"media": "image", "listed_findings": [{"path": image_path, "frame": None, "indices": [0]}]},
        )
        files: object = written["files"]
        assert isinstance(files, dict)
        rows: object = files["results.csv"]
        assert isinstance(rows, list)
        assert len(rows) == 2
        last_export: object = written["last_export"]
        assert isinstance(last_export, dict)
        assert last_export["picture_count"] == 1

    def test_restart_restores_results(self, tmp_path: Path, media_directory: Path, golden: GoldenSnapshot) -> None:
        with self._client_of(tmp_path, [media_directory]) as client:
            self._recognize_everything(client)
            results_before: object = client.get("/api/results").json()
            state_before: JsonDict = self._state(client)
        with self._client_of(tmp_path, []) as restarted:
            _ = restarted.get(f"/?token={ACCESS_TOKEN}")
            assert restarted.get("/api/results").json() == results_before
            state_after: JsonDict = self._state(restarted)
            for key in ("media", "profiles", "shown_profile_key", "sampling", "inference", "task", "thresholds"):
                assert state_after[key] == state_before[key], key
        assert (tmp_path / "data" / "results.ovirresults").is_file()
        assert not (tmp_path / "data" / ".results.ovirresults.partial").exists()
        golden.assert_matches("session_file", json.loads((tmp_path / "data" / "session.json").read_text("utf-8")))

    def test_classification(self, client: TestClient, media_directory: Path, golden: GoldenSnapshot) -> None:
        assert client.put("/api/task", json={"task": "classification"}).is_success
        assert client.put("/api/sampling", json={"frame_step": FRAME_STEP}).is_success
        assert client.put("/api/inference", json={"mode": "all", "is_auto": True}).is_success
        assert client.post("/api/media/open", json={"paths": [str(media_directory)]}).is_success
        self._wait_idle(client)
        golden.assert_matches("classification_results", client.get("/api/results").json())
        video_path: str = str(media_directory / "c_clip.mp4")
        timeline: object = client.get("/api/timeline", params={"path": video_path}).json()
        golden.assert_matches("classification_timeline", timeline)
        golden.assert_matches("classification_statistics", client.get("/api/statistics").json())

    def test_media_are_kept_per_task(self, tmp_path: Path, media_directory: Path) -> None:
        video_path: str = str(media_directory / "c_clip.mp4")
        image_path: str = str(media_directory / "b_second.png")
        with self._client_of(tmp_path, [media_directory]) as client:
            self._recognize_everything(client)
            assert client.post("/api/media/show", json={"path": video_path, "frame": FRAME_STEP}).is_success
            assert client.put("/api/task", json={"task": "classification"}).is_success
            assert self._media_paths(client) == []
            assert self._state(client)["current"] is None
            assert client.post("/api/media/open", json={"paths": [image_path]}).is_success
            assert client.put("/api/task", json={"task": "detection"}).is_success
            assert len(self._media_paths(client)) == 3
            assert self._current_frame(client) == (video_path, FRAME_STEP)
            self._wait_idle(client)
        with self._client_of(tmp_path, []) as restarted:
            _ = restarted.get(f"/?token={ACCESS_TOKEN}")
            assert len(self._media_paths(restarted)) == 3
            assert self._current_frame(restarted) == (video_path, FRAME_STEP)
            assert restarted.put("/api/task", json={"task": "classification"}).is_success
            assert self._media_paths(restarted) == [image_path]

    def test_classes_are_kept_per_task(self, tmp_path: Path, client: TestClient) -> None:
        assert client.put("/api/classes/text", json={"text": "person\ncat"}).is_success
        assert client.put("/api/task", json={"task": "classification"}).is_success
        assert self._class_names(client) == ["person", "car", "dog"]
        assert client.put("/api/classes/text", json={"text": "indoor\noutdoor"}).is_success
        assert client.put("/api/task", json={"task": "detection"}).is_success
        assert self._class_names(client) == ["person", "cat"]
        self._wait_idle(client)
        with self._client_of(tmp_path, []) as restarted:
            _ = restarted.get(f"/?token={ACCESS_TOKEN}")
            assert self._class_names(restarted) == ["person", "cat"]
            assert restarted.put("/api/task", json={"task": "classification"}).is_success
            assert self._class_names(restarted) == ["indoor", "outdoor"]

    def test_sampling_and_inference_are_kept_per_task(self, tmp_path: Path, client: TestClient) -> None:
        assert client.put("/api/task", json={"task": "classification"}).is_success
        assert self._state(client)["sampling"] == {"frame_step": VideoSampling().frame_step}
        assert client.put("/api/sampling", json={"frame_step": 2}).is_success
        assert client.put("/api/inference", json={"mode": "shown", "is_auto": False}).is_success
        assert client.put("/api/task", json={"task": "detection"}).is_success
        assert self._state(client)["sampling"] == {"frame_step": FRAME_STEP}
        assert self._inference_choice(client) == ("all", True)
        self._wait_idle(client)
        with self._client_of(tmp_path, []) as restarted:
            _ = restarted.get(f"/?token={ACCESS_TOKEN}")
            assert self._state(restarted)["sampling"] == {"frame_step": FRAME_STEP}
            assert restarted.put("/api/task", json={"task": "classification"}).is_success
            assert self._state(restarted)["sampling"] == {"frame_step": 2}
            assert self._inference_choice(restarted) == ("shown", False)

    def test_comparison_is_kept_per_task(self, client: TestClient) -> None:
        first_key: object = self._state(client)["shown_profile_key"]
        assert client.put("/api/model/preset", json={"backend": "owl_vit", "preset_name": "v2_base_patch16"}).is_success
        self._wait_idle(client)
        assert client.put("/api/comparison", json={"key": first_key}).is_success
        assert client.put("/api/task", json={"task": "classification"}).is_success
        assert self._state(client)["compared_profile_key"] is None
        assert client.put("/api/task", json={"task": "detection"}).is_success
        assert self._state(client)["compared_profile_key"] == first_key

    def test_closing_media(self, client: TestClient, media_directory: Path, golden: GoldenSnapshot) -> None:
        assert client.post("/api/media/close", json={"paths": [str(media_directory / "a_first.png")]}).is_success
        golden.assert_matches("closed_state", self._state(client))

    def _assert_payloads(self, client: TestClient, media_directory: Path, golden: GoldenSnapshot, name: str) -> None:
        image_path: str = str(media_directory / "a_first.png")
        video_path: str = str(media_directory / "c_clip.mp4")
        golden.assert_matches(f"{name}_state", self._state(client))
        golden.assert_matches(f"{name}_results", client.get("/api/results").json())
        golden.assert_matches(f"{name}_frame_image", client.get("/api/frame", params={"path": image_path}).json())
        golden.assert_matches(
            f"{name}_frame_video", client.get("/api/frame", params={"path": video_path, "frame": 5}).json()
        )
        golden.assert_matches(
            f"{name}_video_frames", client.get("/api/video-frames", params={"path": video_path, "after": 0}).json()
        )
        golden.assert_matches(f"{name}_timeline", client.get("/api/timeline", params={"path": video_path}).json())
        golden.assert_matches(f"{name}_statistics", client.get("/api/statistics").json())
        golden.assert_matches(f"{name}_objects", client.get("/api/results/document").json())

    @staticmethod
    def _listed_images(client: TestClient, minimum_confidence: float = 0.0) -> JsonDict:
        results: JsonDict = client.get("/api/results").json()
        pictures: object = results["pictures"]
        assert isinstance(pictures, list)
        listed: list[JsonDict] = []
        for picture in cast(list[JsonDict], pictures):
            if picture["frame"] is not None:
                continue
            findings: object = picture["findings"]
            assert isinstance(findings, list)
            indices: list[object] = [
                finding["index"]
                for finding in cast(list[JsonDict], findings)
                if cast(float, finding["confidence"]) >= minimum_confidence
            ]
            listed.append({"path": picture["path"], "frame": None, "indices": indices})
        return {"media": "image", "listed_findings": listed}

    def _export(self, client: TestClient, directory: Path, export_format: str, extra: JsonDict) -> JsonDict:
        body: JsonDict = {"export_format": export_format, "output_directory": str(directory), **extra}
        reply: JsonDict = client.post("/api/export", json=body).json()
        assert reply["status"] == "done", reply
        deadline: float = time.monotonic() + TIMEOUT_SECONDS
        while self._state(client)["last_export"] is None:
            assert time.monotonic() < deadline, "export did not finish"
            time.sleep(0.05)
        files: dict[str, object] = {}
        for path in sorted(directory.rglob("*")):
            if not path.is_file():
                continue
            relative: str = path.relative_to(directory).as_posix()
            match path.suffix:
                case ".csv" | ".txt":
                    files[relative] = path.read_text("utf-8").splitlines()
                case ".json":
                    files[relative] = json.loads(path.read_text("utf-8"))
                case _:
                    files[relative] = path.stat().st_size > 0
        return {"files": files, "last_export": self._state(client)["last_export"]}

    @staticmethod
    def _client_of(tmp_path: Path, initial_paths: list[Path]) -> TestClient:
        application: FastAPI = WebApplication(
            ModelSelector(PresetCatalog.from_packages(), DeviceAvailability.detect()),
            WorkspaceStores.in_directory(tmp_path / "data"),
            initial_paths,
            tmp_path,
            ACCESS_TOKEN,
            "ovir_gui_test",
            EmbeddingPolicy(),
            FakeRecognizerSession(),
        ).build()
        client: TestClient = TestClient(application)
        return client

    def _recognize_everything(self, client: TestClient) -> None:
        _ = client.get(f"/?token={ACCESS_TOKEN}")
        assert client.put("/api/sampling", json={"frame_step": FRAME_STEP}).is_success
        assert client.put("/api/inference", json={"mode": "all", "is_auto": True}).is_success
        self._wait_idle(client)

    def _wait_idle(self, client: TestClient) -> None:
        deadline: float = time.monotonic() + TIMEOUT_SECONDS
        while True:
            state: JsonDict = self._state(client)
            if not state["is_busy"] and state["background_progress"] is None and not state["activity"]:
                return
            assert time.monotonic() < deadline, "inference did not finish"
            time.sleep(0.05)

    @staticmethod
    def _class_names(client: TestClient) -> list[str]:
        state: dict[str, list[dict[str, object]]] = client.get("/api/state").json()
        return [str(entry["name"]) for entry in state["classes"]]

    def _media_paths(self, client: TestClient) -> list[object]:
        media: object = self._state(client)["media"]
        assert isinstance(media, list)
        return [entry["path"] for entry in media if isinstance(entry, dict)]

    def _inference_choice(self, client: TestClient) -> tuple[object, object]:
        inference: object = self._state(client)["inference"]
        assert isinstance(inference, dict)
        return inference["mode"], inference["is_auto"]

    def _current_frame(self, client: TestClient) -> tuple[object, object]:
        current: object = self._state(client)["current"]
        assert isinstance(current, dict)
        return current["path"], current["frame"]

    @staticmethod
    def _state(client: TestClient) -> JsonDict:
        state: object = client.get("/api/state").json()
        assert isinstance(state, dict)
        return {str(key): value for key, value in state.items()}
