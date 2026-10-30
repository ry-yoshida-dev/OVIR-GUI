from pathlib import Path

import cv2
import numpy as np

from ovir_gui.workspace import OpenedMedia


class TestOpenedMedia:
    """
    Files are found and read apart from the workspace, counting missing paths, open files and unreadable files.
    """

    def test_folder_is_read_with_missing_known_and_unreadable_paths(self, tmp_path: Path) -> None:
        folder: Path = tmp_path / "pictures"
        folder.mkdir()
        for name in ("a.png", "b.png"):
            _ = cv2.imwrite(str(folder / name), np.zeros((8, 8, 3), dtype=np.uint8))
        (folder / "broken.mp4").write_bytes(b"not a video")
        opened: OpenedMedia = OpenedMedia.read([folder, tmp_path / "unplugged.png"], {(folder / "a.png").resolve()})
        assert [item.path.name for item in opened.items] == ["b.png"]
        assert opened.collection.duplicate_count == 1
        assert opened.missing_count == 1
        assert len(opened.unreadable) == 1
        assert opened.unreadable[0].startswith("broken.mp4")
