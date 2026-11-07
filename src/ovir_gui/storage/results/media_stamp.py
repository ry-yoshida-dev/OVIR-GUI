import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class MediaStamp:
    """
    Modification time and size a media file had when its results were stored, telling whether they still apply.

    Attributes
    ----------
    mtime_ns : int
        Modification time in nanoseconds.
    size : int
        Size in bytes.
    """

    mtime_ns: int
    size: int

    @classmethod
    def of(cls, path: Path) -> "MediaStamp | None":
        """
        Stamp of a file as it is now.

        Parameters
        ----------
        path : Path
            Media file.

        Returns
        -------
        MediaStamp | None
            Current modification time and size, or ``None`` when the file cannot be reached.
        """
        try:
            status: os.stat_result = path.stat()
        except OSError:
            return None
        return cls(mtime_ns=status.st_mtime_ns, size=status.st_size)
