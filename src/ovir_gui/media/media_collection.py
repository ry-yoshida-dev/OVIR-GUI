from collections.abc import Collection, Iterable
from dataclasses import dataclass
from pathlib import Path

from .media_kind import MediaKind


@dataclass(frozen=True)
class MediaCollection:
    """
    Image and video files found in user-given paths, split into new files and paths that add nothing.

    Attributes
    ----------
    media_paths : tuple[Path, ...]
        Resolved image and video files not known before, in the order given; directory contents are sorted by name.
    duplicate_count : int
        Files that were already known.
    unsupported_count : int
        Given paths that are neither directories nor supported files.
    """

    media_paths: tuple[Path, ...]
    duplicate_count: int
    unsupported_count: int

    @classmethod
    def gather(cls, candidate_paths: Iterable[Path], known_paths: Collection[Path]) -> "MediaCollection":
        """
        Expand image and video files and those directly inside directories.

        Hidden files inside directories are skipped.

        Parameters
        ----------
        candidate_paths : Iterable[Path]
            Files and directories chosen or dropped by the user.
        known_paths : Collection[Path]
            Resolved files that are already open.

        Returns
        -------
        MediaCollection
            New files and counts of the ignored paths.
        """
        media_paths: list[Path] = []
        seen_paths: set[Path] = set(known_paths)
        duplicate_count: int = 0
        unsupported_count: int = 0
        for candidate_path in candidate_paths:
            found_paths: list[Path]
            if candidate_path.is_dir():
                found_paths = sorted(
                    entry
                    for entry in candidate_path.iterdir()
                    if not entry.name.startswith(".") and MediaKind.is_supported(entry)
                )
            elif MediaKind.is_supported(candidate_path):
                found_paths = [candidate_path]
            else:
                unsupported_count += 1
                continue
            for found_path in found_paths:
                resolved_path: Path = found_path.resolve()
                if resolved_path in seen_paths:
                    duplicate_count += 1
                    continue
                seen_paths.add(resolved_path)
                media_paths.append(resolved_path)
        return cls(
            media_paths=tuple(media_paths),
            duplicate_count=duplicate_count,
            unsupported_count=unsupported_count,
        )

    @property
    def is_empty(self) -> bool:
        """
        Whether no new file was found.

        Returns
        -------
        bool
            True when ``media_paths`` is empty.
        """
        return not self.media_paths

    def describe(self, headline: str) -> str:
        """
        Status message naming the paths that added nothing.

        Parameters
        ----------
        headline : str
            Leading sentence, e.g. ``"Added 3 files"``.

        Returns
        -------
        str
            ``headline`` followed by the duplicate and unsupported counts in parentheses when there are any.
        """
        notes: list[str] = []
        if self.duplicate_count:
            notes.append(f"{self.duplicate_count} already open")
        if self.unsupported_count:
            notes.append(f"{self.unsupported_count} unsupported skipped")
        return f"{headline} ({', '.join(notes)})." if notes else f"{headline}."
