from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path

from ..export import ExportItem
from ..media import FrameKey, MediaItem
from ..recognition import RecognitionTask


@dataclass(frozen=True, eq=False)
class ExportPreviewSource:
    """
    What a label preview is written from, gathered on the owning thread.

    Attributes
    ----------
    items : tuple[ExportItem, ...]
        Exported pictures with their selected findings.
    task : RecognitionTask
        Task of the results.
    class_names : tuple[str, ...]
        Current classes in id order.
    shown_key : FrameKey | None
        Picture shown in the viewer.
    media : Mapping[Path, MediaItem]
        Open media.
    """

    items: tuple[ExportItem, ...]
    task: RecognitionTask
    class_names: tuple[str, ...]
    shown_key: FrameKey | None
    media: Mapping[Path, MediaItem]
