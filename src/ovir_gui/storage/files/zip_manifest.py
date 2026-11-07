import json
import zipfile
from collections.abc import Callable
from pathlib import Path

from .json_fields import JsonFields, JsonValue


class ZipManifest:
    """
    ZIP file described by a JSON manifest entry, read with every failure to parse it reported as ``ValueError``.
    """

    def __init__(self, path: Path, manifest_name: str, archive_kind: str) -> None:
        """
        Parameters
        ----------
        path : Path
            Location of the ZIP file.
        manifest_name : str
            Entry holding the manifest, e.g. ``"manifest.json"``.
        archive_kind : str
            What the file is, used in error messages, e.g. ``"results archive"``.
        """
        self._path: Path = path
        self._manifest_name: str = manifest_name
        self._archive_kind: str = archive_kind

    def read_with[ContentT](self, reader: Callable[[zipfile.ZipFile, dict[str, JsonValue]], ContentT]) -> ContentT:
        """
        Read the archive while it is open.

        Parameters
        ----------
        reader : Callable[[zipfile.ZipFile, dict[str, JsonValue]], ContentT]
            Reads the content from the open archive and its parsed manifest; a missing entry may raise ``KeyError``
            and a field of another type ``TypeError``.

        Returns
        -------
        ContentT
            What ``reader`` read.

        Raises
        ------
        OSError
            If the file cannot be read.
        ValueError
            If the file is not a ZIP file, lacks an entry, or its manifest is not UTF-8 JSON of the expected form.
        """
        name: str = self._path.name
        try:
            with zipfile.ZipFile(self._path) as archive:
                manifest: dict[str, JsonValue] = JsonFields.object_of(
                    JsonFields.parse(archive.read(self._manifest_name).decode("utf-8")), "manifest"
                )
                return reader(archive, manifest)
        except zipfile.BadZipFile as error:
            raise ValueError(f"{name} is not a {self._archive_kind}: {error}") from error
        except KeyError as error:
            raise ValueError(f"{name} lacks an entry: {error}") from error
        except UnicodeDecodeError as error:
            raise ValueError(f"{self._manifest_name} of {name} is not UTF-8 text.") from error
        except json.JSONDecodeError as error:
            raise ValueError(f"{self._manifest_name} of {name} is not valid JSON: {error}") from error
        except TypeError as error:
            raise ValueError(f"{self._manifest_name} of {name} is malformed: {error}") from error
