import hashlib
import shutil
from pathlib import Path
from typing import BinaryIO, ClassVar


class UploadStore:
    """
    Default folder receiving the images and videos sent from a browser, which cannot tell the server where they are.

    Uploaded files are kept under ``uploads`` in the data directory with the relative folder path they were dropped
    with, so that they can be opened, detected and remembered like any other media file. Sending the same file again
    reuses the stored copy, which keeps its results; a different file of the same name is stored under a numbered
    name instead of replacing the first one.
    """

    DIRECTORY_NAME: ClassVar[str] = "uploads"
    FALLBACK_FILE_NAME: ClassVar[str] = "upload"
    SKIPPED_PARTS: ClassVar[frozenset[str]] = frozenset({"", ".", ".."})
    CHUNK_BYTE_COUNT: ClassVar[int] = 8 * 1024 * 1024

    def __init__(self, root_directory: Path) -> None:
        """
        Parameters
        ----------
        root_directory : Path
            Data directory holding the ``uploads`` folder.
        """
        self._directory: Path = root_directory / self.DIRECTORY_NAME

    @property
    def directory(self) -> Path:
        """
        Folder holding the uploaded files.

        Returns
        -------
        Path
            ``uploads`` under the data directory; created on the first upload.
        """
        return self._directory

    def save(self, relative_name: str, content: BinaryIO) -> Path:
        """
        Store one uploaded file, streaming it to disk so that large videos are never held in memory.

        Parameters
        ----------
        relative_name : str
            File name sent by the browser, possibly with the folders it was dropped in, separated by ``/`` or ``\\``.
            Parts leading outside the folder are dropped.
        content : BinaryIO
            File content, read from its current position to its end.

        Returns
        -------
        Path
            Stored file: an existing copy with the same content, or a new file.

        Raises
        ------
        OSError
            If the file cannot be written.
        """
        target: Path = self._directory.joinpath(*self._safe_parts(relative_name))
        target.parent.mkdir(parents=True, exist_ok=True)
        partial: Path = target.with_name(f".{target.name}.partial")
        try:
            digest: str = self._copy_with_digest(content, partial)
            size: int = partial.stat().st_size
            candidate: Path = target
            copy_number: int = 0
            while candidate.exists():
                if candidate.is_file() and candidate.stat().st_size == size and self._digest_of(candidate) == digest:
                    partial.unlink()
                    return candidate
                copy_number += 1
                candidate = target.with_name(f"{target.stem}-{copy_number}{target.suffix}")
            partial.replace(candidate)
            return candidate
        finally:
            partial.unlink(missing_ok=True)

    def _safe_parts(self, relative_name: str) -> tuple[str, ...]:
        parts: tuple[str, ...] = tuple(
            part.strip()
            for part in relative_name.replace("\\", "/").split("/")
            if part.strip() not in self.SKIPPED_PARTS
        )
        return parts or (self.FALLBACK_FILE_NAME,)

    @classmethod
    def _copy_with_digest(cls, content: BinaryIO, destination: Path) -> str:
        with destination.open("wb") as output:
            shutil.copyfileobj(content, output, cls.CHUNK_BYTE_COUNT)
        return cls._digest_of(destination)

    @staticmethod
    def _digest_of(path: Path) -> str:
        with path.open("rb") as source:
            return hashlib.file_digest(source, "sha256").hexdigest()
