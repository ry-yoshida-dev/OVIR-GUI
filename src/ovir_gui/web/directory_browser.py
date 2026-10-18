from pathlib import Path
from typing import ClassVar

from ..media import MediaKind
from .json_value import JsonObject, JsonValue


class DirectoryBrowser:
    """
    Folders and image files on the server, listed so that the browser can choose what to open.

    The browser cannot see the file system of the server, e.g. of a remote machine reached over SSH, so the user
    picks server paths from these listings. Hidden entries are left out.
    """

    HIDDEN_PREFIX: ClassVar[str] = "."

    def __init__(self, start_directory: Path, shortcuts: dict[str, Path]) -> None:
        """
        Parameters
        ----------
        start_directory : Path
            Directory listed when no path is given.
        shortcuts : dict[str, Path]
            Named directories offered for quick access, e.g. the home and upload directories.
        """
        self._start_directory: Path = start_directory
        self._shortcuts: dict[str, Path] = shortcuts

    def listing_of(self, directory: Path | None) -> JsonObject:
        """
        Sub-directories and supported image and video files of one directory.

        Parameters
        ----------
        directory : Path | None
            Directory to list; the start directory when ``None``. ``~`` is expanded.

        Returns
        -------
        JsonObject
            Absolute path, parent, sorted directory names, sorted files with their kind, and the shortcuts.

        Raises
        ------
        NotADirectoryError
            If the path is not a directory.
        OSError
            If the directory cannot be read.
        """
        resolved: Path = (directory or self._start_directory).expanduser().resolve()
        if not resolved.is_dir():
            raise NotADirectoryError(f"Not a directory: {resolved}")
        directory_names: list[str] = []
        files: list[tuple[str, MediaKind]] = []
        for entry in resolved.iterdir():
            if entry.name.startswith(self.HIDDEN_PREFIX):
                continue
            if entry.is_dir():
                directory_names.append(entry.name)
            elif entry.is_file():
                kind: MediaKind | None = MediaKind.of_path(entry)
                if kind is not None:
                    files.append((entry.name, kind))
        shortcuts: list[JsonValue] = [
            {"name": name, "path": str(path.expanduser().resolve())} for name, path in self._shortcuts.items()
        ]
        sorted_directory_names: list[JsonValue] = [name for name in sorted(directory_names, key=str.casefold)]
        sorted_files: list[JsonValue] = [
            {"name": name, "kind": kind.value} for name, kind in sorted(files, key=lambda file: file[0].casefold())
        ]
        return {
            "path": str(resolved),
            "parent": None if resolved.parent == resolved else str(resolved.parent),
            "directories": sorted_directory_names,
            "files": sorted_files,
            "shortcuts": shortcuts,
        }
