import json
from pathlib import Path

from .atomic_file import AtomicFile
from .json_fields import JsonFields, JsonValue


class JsonFile:
    """
    JSON object stored in one file: read leniently, so a missing or unreadable file reads as absent, and written
    atomically with two-space indentation and non-ASCII characters kept.
    """

    def __init__(self, path: Path) -> None:
        """
        Parameters
        ----------
        path : Path
            Location of the file.
        """
        self._path: Path = path

    @property
    def path(self) -> Path:
        """
        Location of the file.

        Returns
        -------
        Path
            Path given at construction, whether or not it exists.
        """
        return self._path

    def read_object(self, description: str) -> dict[str, JsonValue] | None:
        """
        Read the stored object.

        Parameters
        ----------
        description : str
            What the object holds, used in error messages of the field checks.

        Returns
        -------
        dict[str, JsonValue] | None
            The object; ``None`` when the file is missing, unreadable, not JSON or not an object.
        """
        if not self._path.is_file():
            return None
        try:
            return JsonFields.object_of(JsonFields.parse(self._path.read_text(encoding="utf-8")), description)
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, TypeError):
            return None

    def write(self, content: JsonValue) -> None:
        """
        Replace the file with a JSON document, creating its directory when missing.

        Parameters
        ----------
        content : JsonValue
            Document to store.

        Raises
        ------
        OSError
            If the directory or the file cannot be written.
        """
        AtomicFile(self._path).write_text(json.dumps(content, ensure_ascii=False, indent=2))
