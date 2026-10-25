from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class SessionMedia:
    """
    Media one task had open, restored when the task is shown again.

    Attributes
    ----------
    paths : tuple[Path, ...]
        Open image and video files in list order.
    current_path : Path | None
        Shown file; ``None`` when nothing is shown.
    current_frame_index : int | None
        Shown frame of a video.

    Raises
    ------
    ValueError
        If ``current_path`` is not one of ``paths``.
    """

    paths: tuple[Path, ...] = ()
    current_path: Path | None = None
    current_frame_index: int | None = None

    def __post_init__(self) -> None:
        if self.current_path is not None and self.current_path not in self.paths:
            raise ValueError(f"current_path must be one of paths. got {self.current_path}")
