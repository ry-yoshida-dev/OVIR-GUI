from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response

from ovir_gui.models import DeviceAvailability, ModelSelector, PresetCatalog
from ovir_gui.web import EmbeddingPolicy, WebApplication
from ovir_gui.workspace import WorkspaceStores

ACCESS_TOKEN = "test-token"


class TestReviewRoutes:
    """
    Phrase minimums and the duplicate suppression are set through the API and reported in the state.
    """

    @pytest.fixture
    def client(self, tmp_path: Path) -> Iterator[TestClient]:
        application: FastAPI = WebApplication(
            ModelSelector(PresetCatalog.from_packages(), DeviceAvailability.detect()),
            WorkspaceStores.in_directory(tmp_path / "data"),
            [tmp_path],
            tmp_path,
            ACCESS_TOKEN,
            "ovir_gui_test",
            EmbeddingPolicy(),
        ).build()
        with TestClient(application) as client:
            _ = client.get(f"/?token={ACCESS_TOKEN}")
            yield client

    def test_phrase_minimums_are_reported(self, client: TestClient) -> None:
        body: dict[str, object] = {
            "default_minimum": 0.3,
            "class_minimums": {"car": 0.4},
            "phrase_minimums": {"car": {"suv": 0.6}},
        }
        assert client.put("/api/thresholds", json=body).status_code == 200
        state: Response = client.get("/api/state")
        assert state.json()["thresholds"] == body

    def test_suppression_is_reported(self, client: TestClient) -> None:
        body: dict[str, object] = {
            "is_enabled": True,
            "overlap_threshold": 0.45,
            "class_overlap_thresholds": {"car": 0.7},
        }
        assert client.put("/api/suppression", json=body).status_code == 200
        state: Response = client.get("/api/state")
        assert state.json()["suppression"] == body
        assert state.json()["standard_overlap_threshold"] == 0.5

    def test_out_of_range_overlap_is_refused(self, client: TestClient) -> None:
        body: dict[str, object] = {"is_enabled": True, "overlap_threshold": 1.5, "class_overlap_thresholds": {}}
        assert client.put("/api/suppression", json=body).status_code >= 400
