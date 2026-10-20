import os
from pathlib import Path

from ovir_gui.workspace import PlaybackStore


class TestPlaybackStore:
    """
    Playable copies are keyed by the source file, so a changed source never gets a stale copy.
    """

    def test_missing_copy_is_not_found(self, tmp_path: Path) -> None:
        source: Path = tmp_path / "clip.mov"
        _ = source.write_bytes(b"video")
        assert PlaybackStore(tmp_path / "data").existing(source) is None

    def test_written_copy_is_found(self, tmp_path: Path) -> None:
        source: Path = tmp_path / "clip.mov"
        _ = source.write_bytes(b"video")
        store: PlaybackStore = PlaybackStore(tmp_path / "data")
        copy: Path = store.path_of(source)
        copy.parent.mkdir(parents=True)
        _ = copy.write_bytes(b"copy")
        assert store.existing(source) == copy

    def test_changed_source_gets_another_copy(self, tmp_path: Path) -> None:
        source: Path = tmp_path / "clip.mov"
        _ = source.write_bytes(b"video")
        store: PlaybackStore = PlaybackStore(tmp_path / "data")
        first: Path = store.path_of(source)
        _ = source.write_bytes(b"edited video")
        os.utime(source, ns=(source.stat().st_atime_ns, source.stat().st_mtime_ns + 1_000_000_000))
        assert store.path_of(source) != first

    def test_unreadable_source_has_no_copy(self, tmp_path: Path) -> None:
        assert PlaybackStore(tmp_path / "data").existing(tmp_path / "missing.mov") is None
