from pathlib import Path
from typing import ClassVar

from ..results import ResultLibrary
from .results_archive import ResultsArchive
from .results_manifest_writer import ResultsManifestWriter
from .results_snapshot import ResultsSnapshot


class ResultsStore:
    """
    Results archive of a data directory, ``results.ovirresults``.
    """

    FILE_NAME: ClassVar[str] = "results.ovirresults"

    def __init__(self, root_directory: Path) -> None:
        """
        Parameters
        ----------
        root_directory : Path
            Data directory holding the archive.
        """
        self._archive: ResultsArchive = ResultsArchive(root_directory / self.FILE_NAME)

    @property
    def path(self) -> Path:
        """
        File holding the results.

        Returns
        -------
        Path
            Archive path, whether or not it exists.
        """
        return self._archive.path

    def load(self) -> ResultLibrary:
        """
        Read the saved results.

        Returns
        -------
        ResultLibrary
            Saved results, or an empty library when nothing is saved.

        Raises
        ------
        OSError
            If the archive cannot be read.
        ValueError
            If the archive is invalid.
        """
        if not self._archive.path.is_file():
            return ResultLibrary()
        return self._archive.read()

    @staticmethod
    def snapshot(library: ResultLibrary) -> ResultsSnapshot:
        """
        Convert the results for writing; call on the thread owning them.

        Parameters
        ----------
        library : ResultLibrary
            Results to save.

        Returns
        -------
        ResultsSnapshot
            Detached copy ready for ``write``.
        """
        return ResultsManifestWriter().snapshot(library)

    def write(self, snapshot: ResultsSnapshot) -> None:
        """
        Write a snapshot; safe on any thread.

        Parameters
        ----------
        snapshot : ResultsSnapshot
            Converted results.

        Raises
        ------
        OSError
            If the archive cannot be written.
        """
        self._archive.write(snapshot)
