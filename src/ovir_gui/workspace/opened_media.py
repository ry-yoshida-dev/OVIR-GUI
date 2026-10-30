from collections.abc import Collection, Sequence
from dataclasses import dataclass
from pathlib import Path

from ..media import MediaCollection, MediaItem


@dataclass(frozen=True, eq=False)
class OpenedMedia:
    """
    Image and video files read from user-given paths off the owning thread, ready to be added to the open media.

    Attributes
    ----------
    collection : MediaCollection
        New files found in the existing paths and counts of the paths that added nothing.
    items : tuple[MediaItem, ...]
        Files of ``collection`` that could be read, in its order.
    unreadable : tuple[str, ...]
        File name and error of every file of ``collection`` that could not be read.
    missing_count : int
        Given paths that do not exist.
    """

    collection: MediaCollection
    items: tuple[MediaItem, ...]
    unreadable: tuple[str, ...]
    missing_count: int

    @classmethod
    def read(cls, paths: Sequence[Path], known_paths: Collection[Path]) -> "OpenedMedia":
        """
        Find and read the files of the given paths; touches only the file system, so it is safe on any thread.

        Parameters
        ----------
        paths : Sequence[Path]
            Files and directories chosen by the user.
        known_paths : Collection[Path]
            Resolved files that are already open.

        Returns
        -------
        OpenedMedia
            Files read and the paths that added nothing.
        """
        existing_paths: list[Path] = [path for path in paths if path.exists()]
        collection: MediaCollection = MediaCollection.gather(existing_paths, known_paths)
        items: list[MediaItem] = []
        unreadable: list[str] = []
        for path in collection.media_paths:
            try:
                items.append(MediaItem.open(path))
            except (OSError, ValueError) as error:
                unreadable.append(f"{path.name} ({error})")
        return cls(
            collection=collection,
            items=tuple(items),
            unreadable=tuple(unreadable),
            missing_count=len(paths) - len(existing_paths),
        )
