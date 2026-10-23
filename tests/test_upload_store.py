import io
from pathlib import Path

from ovir_gui.storage import UploadStore


class TestUploadStore:
    """
    Uploads are streamed to disk; the same content reuses its stored copy and other content of the same name is
    numbered.
    """

    def test_same_content_reuses_the_stored_copy(self, tmp_path: Path) -> None:
        store: UploadStore = UploadStore(tmp_path)
        first: Path = store.save("folder/clip.mov", io.BytesIO(b"video"))
        second: Path = store.save("folder/clip.mov", io.BytesIO(b"video"))
        assert first == second == tmp_path / "uploads" / "folder" / "clip.mov"
        assert first.read_bytes() == b"video"
        assert sorted(path.name for path in first.parent.iterdir()) == ["clip.mov"]

    def test_other_content_of_the_same_name_is_numbered(self, tmp_path: Path) -> None:
        store: UploadStore = UploadStore(tmp_path)
        first: Path = store.save("clip.mov", io.BytesIO(b"video"))
        second: Path = store.save("clip.mov", io.BytesIO(b"other video"))
        assert second == first.with_name("clip-1.mov")
        assert second.read_bytes() == b"other video"
        assert sorted(path.name for path in first.parent.iterdir()) == ["clip-1.mov", "clip.mov"]

    def test_content_larger_than_a_chunk_is_stored_whole(self, tmp_path: Path) -> None:
        content: bytes = bytes(range(256)) * (UploadStore.CHUNK_BYTE_COUNT // 256 + 7)
        stored: Path = UploadStore(tmp_path).save("large.mov", io.BytesIO(content))
        assert stored.read_bytes() == content
