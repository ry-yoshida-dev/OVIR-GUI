from collections.abc import Iterator
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response

from ovir_gui.models import DeviceAvailability, ModelSelector, PresetCatalog
from ovir_gui.web import EmbeddingPolicy, WebApplication
from ovir_gui.workspace import WorkspaceStores

ACCESS_TOKEN = "test-token"
IMAGE_WIDTH = 64
IMAGE_HEIGHT = 48
JsonDict = dict[str, object]


class TestPicturePromptRoutes:
    """
    Exemplar boxes and object marks are drawn on open pictures, shown in the state and remembered, and every
    segmentation mode can be chosen; no model is loaded.
    """

    @pytest.fixture
    def media_directory(self, tmp_path: Path) -> Path:
        directory: Path = tmp_path / "media"
        directory.mkdir()
        for name in ("first.png", "second.png"):
            _ = cv2.imwrite(str(directory / name), np.zeros((IMAGE_HEIGHT, IMAGE_WIDTH, 3), dtype=np.uint8))
        return directory

    @pytest.fixture
    def client(self, tmp_path: Path, media_directory: Path) -> Iterator[TestClient]:
        application: FastAPI = WebApplication(
            ModelSelector(PresetCatalog.from_packages(), DeviceAvailability.detect()),
            WorkspaceStores.in_directory(tmp_path / "data"),
            [],
            tmp_path,
            ACCESS_TOKEN,
            "ovir_gui_test",
            EmbeddingPolicy(),
        ).build()
        with TestClient(application) as client:
            _ = client.get(f"/?token={ACCESS_TOKEN}")
            assert client.put("/api/inference", json={"mode": "shown", "is_auto": False}).status_code == 200
            paths: list[str] = [str(media_directory / "first.png"), str(media_directory / "second.png")]
            assert client.post("/api/media/open", json={"paths": paths}).status_code == 200
            yield client

    @staticmethod
    def picture_prompt(client: TestClient) -> JsonDict:
        state: JsonDict = client.get("/api/state").json()
        prompt: object = state["picture_prompt"]
        assert isinstance(prompt, dict)
        return prompt

    def test_marks_get_new_object_ids_and_are_refined(self, client: TestClient, media_directory: Path) -> None:
        picture: JsonDict = {"path": str(media_directory / "first.png"), "frame": None}
        created: Response = client.put(
            "/api/prompts/marks", json={**picture, "class_name": "person", "positive_points": [[10, 12]]}
        )
        assert created.status_code == 200
        object_id: object = created.json()["object_id"]
        assert object_id == 1
        refined: Response = client.put(
            "/api/prompts/marks",
            json={
                **picture,
                "object_id": object_id,
                "class_name": "person",
                "positive_points": [[10, 12]],
                "negative_points": [[20, 22]],
                "box": [2, 2, 30, 30],
            },
        )
        assert refined.json() == {"object_id": 1}
        prompt: JsonDict = self.picture_prompt(client)
        assert prompt["marks"] == [
            {
                "object_id": 1,
                "class_name": "person",
                "positive_points": [[10.0, 12.0]],
                "negative_points": [[20.0, 22.0]],
                "box": [2.0, 2.0, 30.0, 30.0],
            }
        ]
        assert prompt["next_object_id"] == 2

    def test_exemplars_are_added_and_removed(self, client: TestClient, media_directory: Path) -> None:
        picture: JsonDict = {"path": str(media_directory / "first.png"), "frame": None}
        for is_positive in (True, False):
            response: Response = client.post(
                "/api/prompts/exemplars",
                json={**picture, "class_name": "car", "box": [1, 1, 20, 20], "is_positive": is_positive},
            )
            assert response.status_code == 200
        assert [entry["is_positive"] for entry in self.exemplars(client)] == [True, False]
        assert client.post("/api/prompts/exemplars/remove", json={**picture, "index": 0}).status_code == 200
        assert [entry["is_positive"] for entry in self.exemplars(client)] == [False]

    def exemplars(self, client: TestClient) -> list[JsonDict]:
        exemplars: object = self.picture_prompt(client)["exemplars"]
        assert isinstance(exemplars, list)
        return [entry for entry in exemplars if isinstance(entry, dict)]

    def test_drawings_of_unknown_classes_are_refused(self, client: TestClient, media_directory: Path) -> None:
        picture: JsonDict = {"path": str(media_directory / "first.png"), "frame": None}
        for class_name in ("unicorn", " "):
            response: Response = client.put(
                "/api/prompts/marks", json={**picture, "class_name": class_name, "box": [1, 1, 5, 5]}
            )
            assert response.status_code == 400
        assert self.picture_prompt(client)["marks"] == []

    def test_every_segmentation_mode_is_offered(self, client: TestClient) -> None:
        assert client.put("/api/task", json={"task": "segmentation"}).status_code == 200
        model: JsonDict = client.get("/api/state").json()["model"]
        modes: object = model["modes"]
        assert isinstance(modes, list)
        assert [mode["value"] for mode in modes if isinstance(mode, dict)] == [
            "concept",
            "promptable",
            "generation",
            "tracker",
            "concept_tracker",
        ]

    @pytest.mark.parametrize(
        ("backend", "preset", "prompt_mode", "drawing_kinds", "is_sequential"),
        [
            ("sam3", "original", "classes", ["exemplar"], False),
            ("promptable/sam2", "hiera_tiny", "marks", ["mark"], False),
            ("generation/sam2", "hiera_tiny", "automatic", [], False),
            ("tracker/sam2", "hiera_tiny", "marks", ["mark"], True),
            ("concept_tracker/sam3", "original", "classes", [], True),
        ],
    )
    def test_segmentation_modes_describe_their_prompting(
        self,
        client: TestClient,
        backend: str,
        preset: str,
        prompt_mode: str,
        drawing_kinds: list[str],
        is_sequential: bool,
    ) -> None:
        assert client.put("/api/task", json={"task": "segmentation"}).status_code == 200
        assert client.put("/api/model/preset", json={"backend": backend, "preset_name": preset}).status_code == 200
        model: JsonDict = client.get("/api/state").json()["model"]
        assert model["prompt_mode"] == prompt_mode
        assert model["drawing_kinds"] == drawing_kinds
        assert model["is_sequential"] is is_sequential

    def test_mark_models_refuse_to_run_without_marks(self, client: TestClient) -> None:
        assert client.put("/api/task", json={"task": "segmentation"}).status_code == 200
        response: Response = client.put(
            "/api/model/preset", json={"backend": "promptable/sam2", "preset_name": "hiera_tiny"}
        )
        assert response.status_code == 200
        reply: JsonDict = client.post("/api/run", json={"is_skipping_approved": False}).json()
        assert reply["status"] == "rejected"
        message: object = reply["message"]
        assert isinstance(message, str) and "mark" in message

    def test_drawings_survive_a_restart(self, tmp_path: Path, client: TestClient, media_directory: Path) -> None:
        picture: JsonDict = {"path": str(media_directory / "second.png"), "frame": None}
        _ = client.put("/api/prompts/marks", json={**picture, "class_name": "dog", "box": [3, 3, 9, 9]})
        stored: str = (tmp_path / "data" / "picture_prompts.json").read_text(encoding="utf-8")
        assert '"class": "dog"' in stored
