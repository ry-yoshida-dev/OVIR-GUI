import hashlib
import os
from pathlib import Path
from typing import ClassVar


class PlaybackStore:
    """
    Folder caching the browser-playable copies of videos, ``playback`` in the data directory.

    A copy is named after the source path, size and modification time, so editing or replacing the source makes a new
    copy instead of serving a stale one.
    """

    DIRECTORY_NAME: ClassVar[str] = "playback"
    SUFFIX: ClassVar[str] = ".mp4"

    def __init__(self, root_directory: Path) -> None:
        """
        Parameters
        ----------
        root_directory : Path
            Data directory holding the ``playback`` folder.
        """
        self._directory: Path = root_directory / self.DIRECTORY_NAME

    def path_of(self, source: Path) -> Path:
        """
        Where the copy of a video is kept.

        Parameters
        ----------
        source : Path
            Video file.

        Returns
        -------
        Path
            Copy under the ``playback`` folder.

        Raises
        ------
        OSError
            If the source cannot be read.
        """
        status: os.stat_result = source.stat()
        identity: str = f"{source.resolve()}|{status.st_size}|{status.st_mtime_ns}"
        digest: str = hashlib.sha256(identity.encode()).hexdigest()[:24]
        return self._directory / f"{source.stem}-{digest}{self.SUFFIX}"

    def existing(self, source: Path) -> Path | None:
        """
        Copy of a video, if one was made.

        Parameters
        ----------
        source : Path
            Video file.

        Returns
        -------
        Path | None
            ``None`` when no copy exists or the source cannot be read.
        """
        try:
            copy: Path = self.path_of(source)
        except OSError:
            return None
        return copy if copy.is_file() else None
