from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

from PIL import Image

from ..media import FrameKey, MediaItem, PictureLoader
from .export_item import ExportItem
from .overlay_renderer import OverlayRenderer


class AnnotatedImageWriter:
    """
    Saves every exported picture with its exported findings drawn, as JPEG in ``annotated/``; never over a source.
    """

    DIRECTORY_NAME: ClassVar[str] = "annotated"
    JPEG_QUALITY: ClassVar[int] = 90

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
        Draw and save the pictures.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures.
        media : dict[Path, MediaItem]
            Open media, telling videos apart.
        directory : Path
            Output directory.

        Returns
        -------
        tuple[Path, ...]
            Written files.
        """
        by_key: dict[FrameKey, ExportItem] = {item.frame_key: item for item in items}
        ordered: list[FrameKey] = sorted(by_key, key=FrameKey.sort_key)
        target_directory: Path = directory / self.DIRECTORY_NAME
        target_directory.mkdir(parents=True, exist_ok=True)
        written: list[Path] = []
        used_names: set[str] = set()
        for frame_key, picture in PictureLoader(media).load(ordered):
            if isinstance(picture, Exception):
                continue
            item: ExportItem = by_key[frame_key]
            annotated: Image.Image = self._renderer.render(picture, item.result, item.label)
            target: Path = target_directory / self._unique_name(frame_key, used_names)
            annotated.save(target, quality=self.JPEG_QUALITY)
            written.append(target)
        return tuple(written)

    @staticmethod
    def _unique_name(frame_key: FrameKey, used_names: set[str]) -> str:
        stem: str = (
            frame_key.path.stem
            if frame_key.frame_index is None
            else f"{frame_key.path.stem}_f{frame_key.frame_index:06d}"
        )
        name: str = f"{stem}.jpg"
        number: int = 1
        while name.casefold() in used_names:
            number += 1
            name = f"{stem}_{number}.jpg"
        used_names.add(name.casefold())
        return name
