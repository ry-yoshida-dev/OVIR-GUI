import io
import json
import zipfile
from itertools import pairwise
from pathlib import Path
from typing import ClassVar

import numpy as np

from ..recognition.array_types import UInt8Array
from ..results import ResultLibrary
from .json_fields import JsonFields, JsonValue
from .results_manifest_reader import ResultsManifestReader
from .results_snapshot import ResultsSnapshot


class ResultsArchive:
    """
    Every stored result in one ZIP file: ``manifest.json`` and, with masks, ``masks.npz``.

    ``masks.npz`` holds ``bits`` (the packed bits of every mask, concatenated) and ``offsets`` (where each mask starts
    in ``bits``, with the total length last). Writing goes through a temporary file, so a failed write leaves the
    previous archive intact.
    """

    MANIFEST_NAME: ClassVar[str] = "manifest.json"
    MASKS_NAME: ClassVar[str] = "masks.npz"
    PARTIAL_SUFFIX: ClassVar[str] = ".partial"

    def __init__(self, path: Path) -> None:
        """
        Parameters
        ----------
        path : Path
            Location of the archive.
        """
        self._path: Path = path

    @property
    def path(self) -> Path:
        """
        Location of the archive.

        Returns
        -------
        Path
            Path given at construction.
        """
        return self._path

    def read(self) -> ResultLibrary:
        """
        Read every stored result.

        Returns
        -------
        ResultLibrary
            Results of unchanged media files.

        Raises
        ------
        OSError
            If the file cannot be read.
        ValueError
            If the file is not a valid results archive.
        """
        try:
            with zipfile.ZipFile(self._path) as archive:
                manifest: dict[str, JsonValue] = JsonFields.object_of(
                    JsonFields.parse(archive.read(self.MANIFEST_NAME).decode("utf-8")), "manifest"
                )
                mask_bits: list[UInt8Array] = (
                    self._read_masks(archive.read(self.MASKS_NAME)) if self.MASKS_NAME in archive.namelist() else []
                )
            return ResultsManifestReader(mask_bits).read(manifest)
        except zipfile.BadZipFile as error:
            raise ValueError(f"{self._path.name} is not a results archive: {error}") from error
        except KeyError as error:
            raise ValueError(f"{self._path.name} lacks an entry: {error}") from error
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError) as error:
            raise ValueError(f"{self._path.name} is malformed: {error}") from error

    def write(self, snapshot: ResultsSnapshot) -> None:
        """
        Write a snapshot, replacing the file.

        Parameters
        ----------
        snapshot : ResultsSnapshot
            Results converted on the owning thread.

        Raises
        ------
        OSError
            If the file cannot be written.
        """
        self._path.parent.mkdir(parents=True, exist_ok=True)
        partial_path: Path = self._path.with_name(self._path.name + self.PARTIAL_SUFFIX)
        try:
            with zipfile.ZipFile(partial_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
                archive.writestr(self.MANIFEST_NAME, json.dumps(snapshot.manifest, ensure_ascii=False))
                if snapshot.mask_bits:
                    archive.writestr(self.MASKS_NAME, self._masks_bytes(snapshot.mask_bits))
            partial_path.replace(self._path)
        finally:
            partial_path.unlink(missing_ok=True)

    @staticmethod
    def _masks_bytes(mask_bits: tuple[UInt8Array, ...]) -> bytes:
        lengths: list[int] = [int(bits.shape[0]) for bits in mask_bits]
        offsets: np.ndarray = np.concatenate(([0], np.cumsum(lengths))).astype(np.int64)
        buffer: io.BytesIO = io.BytesIO()
        np.savez_compressed(buffer, bits=np.concatenate(mask_bits).astype(np.uint8), offsets=offsets)
        return buffer.getvalue()

    @staticmethod
    def _read_masks(content: bytes) -> list[UInt8Array]:
        with np.load(io.BytesIO(content), allow_pickle=False) as arrays:
            bits: UInt8Array = np.asarray(arrays["bits"], dtype=np.uint8)
            offsets: list[int] = [int(offset) for offset in np.asarray(arrays["offsets"]).tolist()]
        if not offsets or offsets[-1] != bits.shape[0]:
            raise ValueError("mask offsets do not match the mask bits.")
        return [bits[start:end] for start, end in pairwise(offsets)]
