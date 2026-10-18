from enum import Enum
from pathlib import Path


class MediaKind(Enum):
    """
    Kind of media file the user opens.

    Attributes
    ----------
    IMAGE : str
        Still image; recognized once.
    VIDEO : str
        Video; recognized on its sampled frames.
    """

    IMAGE = "image"
    VIDEO = "video"

    @property
    def suffixes(self) -> frozenset[str]:
        """
        File suffixes of the kind.

        Returns
        -------
        frozenset[str]
            Lower-case suffixes with their dot.
        """
        match self:
            case MediaKind.IMAGE:
                return frozenset({".jpg", ".jpeg", ".png", ".bmp", ".webp", ".tif", ".tiff"})
            case MediaKind.VIDEO:
                return frozenset({".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".mpg", ".mpeg", ".wmv"})

    @classmethod
    def of_path(cls, path: Path) -> "MediaKind | None":
        """
        Kind of a file judged by its suffix.

        Parameters
        ----------
        path : Path
            Candidate file.

        Returns
        -------
        MediaKind | None
            ``None`` when the suffix belongs to no kind.
        """
        suffix: str = path.suffix.lower()
        return next((kind for kind in cls if suffix in kind.suffixes), None)

    @classmethod
    def is_supported(cls, path: Path) -> bool:
        """
        Whether a path is an existing file of a supported kind.

        Parameters
        ----------
        path : Path
            Candidate file.

        Returns
        -------
        bool
            True for an image or video file.
        """
        return path.is_file() and cls.of_path(path) is not None

    @classmethod
    def accepted_suffixes(cls) -> tuple[str, ...]:
        """
        Every supported suffix.

        Returns
        -------
        tuple[str, ...]
            Sorted suffixes of all kinds.
        """
        return tuple(sorted(suffix for kind in cls for suffix in kind.suffixes))
