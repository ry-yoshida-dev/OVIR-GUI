from collections.abc import Iterator
from pathlib import Path

import cv2
import numpy as np
import pytest
from fastapi.testclient import TestClient
from httpx import Response

from ovir_gui.models import DeviceAvailability, ModelSelector, PresetCatalog
from ovir_gui.web import EmbeddingPolicy, WebApplication
from ovir_gui.workspace import WorkspaceStores

ACCESS_TOKEN = "test-token"
PARENT_ORIGIN = "http://localhost:3000"
IMAGE_WIDTH = 64
IMAGE_HEIGHT = 48


class TestEmbeddingRoutes:
    """
    Embedding pages learn the allowed parent origins and get result documents, and every response limits framing to
    the embedding origins.
    """

    @pytest.fixture
    def image_path(self, tmp_path: Path) -> Path:
        path: Path = tmp_path / "field.png"
        _ = cv2.imwrite(str(path), np.zeros((IMAGE_HEIGHT, IMAGE_WIDTH, 3), dtype=np.uint8))
        return path

    @pytest.fixture
    def client(self, tmp_path: Path, image_path: Path) -> Iterator[TestClient]:
        availability: DeviceAvailability = DeviceAvailability(is_cuda_available=False, is_mps_available=False)
        application: WebApplication = WebApplication(
            ModelSelector(PresetCatalog.from_packages(), availability),
            WorkspaceStores.in_directory(tmp_path / "data"),
            [image_path],
            tmp_path,
            ACCESS_TOKEN,
            "ovir_gui_test",
            EmbeddingPolicy.of([PARENT_ORIGIN]),
        )
        with TestClient(application.build()) as client:
            _ = client.get(f"/?token={ACCESS_TOKEN}")
            yield client

    def test_results_document_without_results_is_empty(self, client: TestClient, image_path: Path) -> None:
        response: Response = client.get("/api/results/document", params={"path": str(image_path)})
        assert response.status_code == 200
        document: dict[str, object] = response.json()
        assert document["format"] == "ovir-gui-objects"
        assert document["pictures"] == []

    def test_document_of_a_closed_file_is_refused(self, client: TestClient, tmp_path: Path) -> None:
        response: Response = client.get("/api/results/document", params={"path": str(tmp_path / "missing.png")})
        assert response.status_code == 400

    def test_responses_limit_framing_to_embedding_origins(self, client: TestClient) -> None:
        response: Response = client.get("/api/embedding")
        assert response.json() == {"parent_origins": [PARENT_ORIGIN]}
        assert response.headers["content-security-policy"] == f"frame-ancestors 'self' {PARENT_ORIGIN}"
        client.cookies.clear()
        refused: Response = client.get("/api/state")
        assert refused.status_code == 403
        assert refused.headers["content-security-policy"] == f"frame-ancestors 'self' {PARENT_ORIGIN}"
