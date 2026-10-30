from datetime import datetime
from pathlib import Path
from typing import ClassVar

from ..results import ResultLibrary
from .media_stamp import MediaStamp
from .restored_results import RestoredResults
from .results_archive import ResultsArchive
from .results_manifest_writer import ResultsManifestWriter
from .results_snapshot import ResultsSnapshot


class ResultsStore:
    """
    Results archive of a data directory, ``results.ovirresults``.

    Results of media files that cannot be reached when the archive is loaded, such as ones on a disconnected drive,
    are written back with their stored stamp, so saving never drops them.
    """

    FILE_NAME: ClassVar[str] = "results.ovirresults"
    UNREADABLE_TIME_FORMAT: ClassVar[str] = "%Y%m%d-%H%M%S"

    def __init__(self, root_directory: Path) -> None:
        """
        Parameters
        ----------
        root_directory : Path
            Data directory holding the archive.
        """
        self._archive: ResultsArchive = ResultsArchive(root_directory / self.FILE_NAME)
        self._unreachable_media: dict[Path, MediaStamp] = {}

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
        restored: RestoredResults = self._archive.read()
        self._unreachable_media = restored.unreachable_media
        return restored.library

    def set_aside(self) -> Path:
        """
        Rename an archive that could not be loaded, so the next save does not overwrite it.

        Returns
        -------
        Path
            New name of the archive, ``results.ovirresults.unreadable-<time>``.

        Raises
        ------
        OSError
            If the archive cannot be renamed.
        """
        kept_path: Path = self._archive.path.with_name(
            f"{self.FILE_NAME}.unreadable-{datetime.now().strftime(self.UNREADABLE_TIME_FORMAT)}"
        )
        return self._archive.path.rename(kept_path)

    def snapshot(self, library: ResultLibrary) -> ResultsSnapshot:
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
        return ResultsManifestWriter(self._unreachable_media).snapshot(library)

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
