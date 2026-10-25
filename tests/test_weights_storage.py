from pathlib import Path

import pytest

from ovir_gui.models import StoredWeights, WeightsStorage


class TestWeightsStorage:
    """
    Downloaded weights are found in the Hugging Face hub cache and the Ultralytics directories, sized, and deleted.
    """

    COMMIT_HASH: str = "0123456789abcdef0123456789abcdef01234567"

    def test_hub_repository_and_ultralytics_file_are_listed_in_order(self, tmp_path: Path) -> None:
        hub_cache: Path = tmp_path / "hub"
        self._cache_repository(hub_cache, "owner/model", {"model.safetensors": b"x" * 300, "config.json": b"{}"})
        weights_directory: Path = tmp_path / "weights"
        weights_directory.mkdir()
        (weights_directory / "yoloe-11s-seg.pt").write_bytes(b"y" * 50)
        storage: WeightsStorage = WeightsStorage(hub_cache, [tmp_path / "start", weights_directory])
        stored: tuple[StoredWeights, ...] = storage.stored(
            ["yoloe-11s-seg.pt", "owner/model", "owner/missing", "yolov8s-worldv2.pt", "owner/model"]
        )
        assert stored == (StoredWeights("yoloe-11s-seg.pt", 50), StoredWeights("owner/model", 302))

    def test_deleted_hub_repository_is_no_longer_listed(self, tmp_path: Path) -> None:
        hub_cache: Path = tmp_path / "hub"
        self._cache_repository(hub_cache, "owner/model", {"model.safetensors": b"x" * 300})
        self._cache_repository(hub_cache, "owner/other", {"model.safetensors": b"z" * 10})
        storage: WeightsStorage = WeightsStorage(hub_cache, [])
        storage.delete("owner/model")
        assert storage.stored(["owner/model", "owner/other"]) == (StoredWeights("owner/other", 10),)

    def test_ultralytics_file_found_first_is_deleted(self, tmp_path: Path) -> None:
        start_directory: Path = tmp_path / "start"
        start_directory.mkdir()
        (start_directory / "yoloe-11s-seg.pt").write_bytes(b"y")
        storage: WeightsStorage = WeightsStorage(tmp_path / "hub", [start_directory])
        storage.delete("yoloe-11s-seg.pt")
        assert not (start_directory / "yoloe-11s-seg.pt").exists()

    def test_missing_weights_cannot_be_deleted(self, tmp_path: Path) -> None:
        storage: WeightsStorage = WeightsStorage(tmp_path / "hub", [tmp_path])
        with pytest.raises(FileNotFoundError):
            storage.delete("owner/model")
        with pytest.raises(FileNotFoundError):
            storage.delete("yoloe-11s-seg.pt")

    def _cache_repository(self, hub_cache: Path, repo_id: str, contents: dict[str, bytes]) -> None:
        repository: Path = hub_cache / ("models--" + repo_id.replace("/", "--"))
        snapshot: Path = repository / "snapshots" / self.COMMIT_HASH
        (repository / "blobs").mkdir(parents=True)
        snapshot.mkdir(parents=True)
        (repository / "refs").mkdir()
        (repository / "refs" / "main").write_text(self.COMMIT_HASH)
        for blob_index, (file_name, content) in enumerate(contents.items()):
            blob_name: str = f"blob{blob_index}"
            (repository / "blobs" / blob_name).write_bytes(content)
            (snapshot / file_name).symlink_to(Path("..") / ".." / "blobs" / blob_name)
