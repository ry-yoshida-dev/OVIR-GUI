from dataclasses import dataclass
from pathlib import Path

from ..results import ResultLibrary
from .media_stamp import MediaStamp


@dataclass(frozen=True, eq=False)
class RestoredResults:
    """
    Results read back from a results archive.

    Attributes
    ----------
    library : ResultLibrary
        Results of every media file that is unchanged or cannot be reached now.
    unreachable_media : dict[Path, MediaStamp]
        Stored stamp of every media file that cannot be reached now, such as one on a disconnected drive; its results
        are kept and written back with this stamp so they apply again once the file is back unchanged.
    """

    library: ResultLibrary
    unreachable_media: dict[Path, MediaStamp]
