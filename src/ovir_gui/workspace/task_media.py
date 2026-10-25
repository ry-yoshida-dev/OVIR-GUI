from dataclasses import dataclass, field
from pathlib import Path

from ..media import FrameKey, MediaItem


@dataclass
class TaskMedia:
    """
    Open media of a task that is not shown, kept until the user switches back to it.

    Attributes
    ----------
    media : dict[Path, MediaItem]
        Open files in list order.
    current_key : FrameKey | None
        Picture shown when the task was left.
    """

    media: dict[Path, MediaItem] = field(default_factory=dict[Path, MediaItem])
    current_key: FrameKey | None = None
