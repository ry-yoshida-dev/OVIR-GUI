import os
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path


class AtomicFile:
    """
    File replaced in one step: new content is written to a hidden partial file next to it, ``.<name>.partial``, which
    is flushed to disk and then replaces the file, so a failed write or a power loss leaves the previous content
    intact.
    """

    def __init__(self, path: Path) -> None:
        """
        Parameters
        ----------
        path : Path
            File to replace.
        """
        self._path: Path = path

    @property
    def path(self) -> Path:
        """
        File to replace.

        Returns
        -------
        Path
            Path given at construction.
        """
        return self._path

    @property
    def partial_path(self) -> Path:
        """
        Partial file new content is written to.

        Returns
        -------
        Path
            ``.<name>.partial`` in the directory of the file.
        """
        return self._path.with_name(f".{self._path.name}.partial")

    @contextmanager
    def staged(self) -> Generator[Path]:
        """
        Partial file to write, removed when the block ends unless the block moved it away.

        Yields
        ------
        Path
            ``partial_path``, in a directory created when missing.

        Raises
        ------
        OSError
            If the directory cannot be created.
        """
        self._path.parent.mkdir(parents=True, exist_ok=True)
        try:
            yield self.partial_path
        finally:
            self.partial_path.unlink(missing_ok=True)

    @contextmanager
    def replacing(self) -> Generator[Path]:
        """
        Partial file to write, replacing the file when the block ends without an error.

        Yields
        ------
        Path
            ``partial_path``, in a directory created when missing.

        Raises
        ------
        OSError
            If the directory cannot be created or the file cannot be replaced.
        """
        with self.staged() as partial_path:
            yield partial_path
            with partial_path.open("rb") as written:
                os.fsync(written.fileno())
            partial_path.replace(self._path)

    def write_text(self, text: str) -> None:
        """
        Replace the file with UTF-8 text.

        Parameters
        ----------
        text : str
            New content.

        Raises
        ------
        OSError
            If the file cannot be written.
        """
        with self.replacing() as partial_path:
            partial_path.write_text(text, encoding="utf-8")
