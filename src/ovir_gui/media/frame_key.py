from dataclasses import dataclass
from pathlib import Path

from .media_kind import MediaKind


@dataclass(frozen=True, order=True)
class FrameKey:
    """
    One recognizable picture: an image file, or one frame of a video file.

    Attributes
    ----------
    path : Path
        Media file.
    frame_index : int | None
        Zero-based frame of a video; ``None`` for an image.

    Raises
    ------
    ValueError
        If the frame index is negative.
    """

    path: Path
    frame_index: int | None = None

    def __post_init__(self) -> None:
        if self.frame_index is not None and self.frame_index < 0:
            raise ValueError(f"frame_index must not be negative. got {self.frame_index}")

    @property
    def label(self) -> str:
        """
        Short name for people.

        Returns
        -------
        str
            File name, followed by ``#<frame>`` for a video frame.
        """
        return self.path.name if self.frame_index is None else f"{self.path.name}#{self.frame_index}"

    @property
    def media_kind(self) -> MediaKind:
        """
        Kind of the media file of the picture.

        Returns
        -------
        MediaKind
            ``IMAGE`` for an image, ``VIDEO`` for a video frame.
        """
        return MediaKind.IMAGE if self.frame_index is None else MediaKind.VIDEO

    def sort_key(self) -> tuple[str, int]:
        """
        Key ordering images and frames by path, then frame.

        Returns
        -------
        tuple[str, int]
            Path text and frame index (``-1`` for an image).
        """
        return (str(self.path), -1 if self.frame_index is None else self.frame_index)
