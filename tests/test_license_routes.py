import sys
from collections.abc import Iterator
from importlib.machinery import ModuleSpec
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from httpx import Response

from ovir_gui.models import DeviceAvailability, LicensedDependency, ModelSelector, PresetCatalog
from ovir_gui.web import EmbeddingPolicy, WebApplication
from ovir_gui.workspace import WorkspaceStores

ACCESS_TOKEN = "test-token"
LICENSED_BACKEND = "yoloe"
LICENSED_PRESET = "26s"


class TestLicenseRoutes:
    """
    Models of an optional module of a restrictive license can be chosen only after its license is accepted, and
    accepting it does not import the module.
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

    @pytest.fixture
    def installed(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def found_spec(name: str) -> ModuleSpec:
            return ModuleSpec(name, None)

        monkeypatch.setattr("ovir_gui.models.licensed_dependency.find_spec", found_spec)

    @pytest.fixture
    def missing(self, monkeypatch: pytest.MonkeyPatch) -> None:
        def no_spec(name: str) -> None:
            return None

        monkeypatch.setattr("ovir_gui.models.licensed_dependency.find_spec", no_spec)

    def _select_licensed_preset(self, client: TestClient) -> Response:
        return client.put("/api/model/preset", json={"backend": LICENSED_BACKEND, "preset_name": LICENSED_PRESET})

    def test_licensed_presets_are_marked(self, client: TestClient) -> None:
        state: Response = client.get("/api/state")
        licenses_by_backend: dict[str, list[str]] = {
            entry["value"]: entry["presets"][0]["licenses"] for entry in state.json()["model"]["backends"]
        }
        assert licenses_by_backend[LICENSED_BACKEND] == [LicensedDependency.ULTRALYTICS.value]
        assert licenses_by_backend["grounding_dino"] == []

    def test_unaccepted_license_refuses_the_model(self, client: TestClient, installed: None) -> None:
        response: Response = self._select_licensed_preset(client)
        assert response.status_code == 400
        assert "AGPL-3.0" in response.json()["detail"]
        assert client.get("/api/state").json()["model"]["selection"]["backend"] != LICENSED_BACKEND

    def test_accepted_license_allows_the_model_without_import(self, client: TestClient, installed: None) -> None:
        assert client.post("/api/licenses/accept", json={"dependency": "ultralytics"}).status_code == 200
        assert self._select_licensed_preset(client).status_code == 200
        state: Response = client.get("/api/state")
        assert state.json()["model"]["selection"]["backend"] == LICENSED_BACKEND
        assert state.json()["model"]["licenses"][0]["is_accepted"] is True
        assert "ultralytics" not in sys.modules

    def test_acceptance_is_remembered(self, tmp_path: Path, client: TestClient, installed: None) -> None:
        assert client.post("/api/licenses/accept", json={"dependency": "ultralytics"}).status_code == 200
        stores: WorkspaceStores = WorkspaceStores.in_directory(tmp_path / "data")
        assert stores.license_consent_store.load() == frozenset({LicensedDependency.ULTRALYTICS})

    def test_missing_module_cannot_be_accepted(self, client: TestClient, missing: None) -> None:
        response: Response = client.post("/api/licenses/accept", json={"dependency": "ultralytics"})
        assert response.status_code == 400
        assert "pip install" in response.json()["detail"]
