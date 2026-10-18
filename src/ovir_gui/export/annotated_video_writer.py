import bisect
from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

import numpy as np
from PIL import Image
from video_handler import OpenCVVideoWriter, OpenCVWriteOptions, VideoCodec, VideoWriteParameters

from ..media import MediaItem, VideoFrameReader
from .export_item import ExportItem
from .overlay_renderer import OverlayRenderer


class AnnotatedVideoWriter:
    """
    Saves every exported video with its findings drawn on every frame, as ``annotated/<stem>_annotated.mp4``.

    Each frame shows the result of the latest exported frame at or before it, so a video sampled every few frames
    plays smoothly at its own frame rate.
    """

    DIRECTORY_NAME: ClassVar[str] = "annotated"

    def __init__(self, renderer: OverlayRenderer) -> None:
        """
        Parameters
        ----------
        renderer : OverlayRenderer
            Drawing of the findings.
        """
        self._renderer: OverlayRenderer = renderer

    def write(self, items: Sequence[ExportItem], media: dict[Path, MediaItem], directory: Path) -> tuple[Path, ...]:
        """
        Draw and encode the videos.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures; frames of videos are grouped per video.
        media : dict[Path, MediaItem]
            Open media with their stream properties.
        directory : Path
            Output directory.

        Returns
        -------
        tuple[Path, ...]
            Written videos.
        """
        by_video: dict[Path, dict[int, ExportItem]] = {}
        for item in items:
            if item.frame_key.frame_index is not None:
                by_video.setdefault(item.frame_key.path, {})[item.frame_key.frame_index] = item
        target_directory: Path = directory / self.DIRECTORY_NAME
        written: list[Path] = []
        for path, frame_items in by_video.items():
            media_item: MediaItem | None = media.get(path)
            if media_item is None or media_item.video is None:
                continue
            target_directory.mkdir(parents=True, exist_ok=True)
            written.append(self._write_video(media_item, frame_items, target_directory / f"{path.stem}_annotated.mp4"))
        return tuple(written)

    def _write_video(self, media_item: MediaItem, frame_items: dict[int, ExportItem], target: Path) -> Path:
        frame_indices: list[int] = sorted(frame_items)
        reader: VideoFrameReader = VideoFrameReader(media_item.path, media_item.video_info)
        with OpenCVVideoWriter(
            str(target),
            VideoWriteParameters(fps=media_item.video_info.fps),
            OpenCVWriteOptions(codec=VideoCodec.MP4V),
        ) as writer:
            for frame_index, picture in reader.read(range(media_item.video_info.frame_count)):
                position: int = bisect.bisect_right(frame_indices, frame_index)
                annotated: Image.Image = picture
                if position:
                    item: ExportItem = frame_items[frame_indices[position - 1]]
                    annotated = self._renderer.render(picture, item.result, item.label)
                writer.write(np.ascontiguousarray(np.asarray(annotated, dtype=np.uint8)[:, :, ::-1]))
        return target
