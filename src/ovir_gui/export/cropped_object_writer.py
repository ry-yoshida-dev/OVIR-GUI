import csv
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import ClassVar

from PIL import Image

from ..media import FrameKey, MediaItem, PictureLoader
from ..recognition import PixelBox, RecognizedInstance
from .crop_options import CropOptions
from .export_item import ExportItem


class CroppedObjectWriter:
    """
    Saves the box of every exported instance, widened by the crop margin, as its own image in ``crops/<class>/``,
    ready to be classified, and lists every crop with its source in ``crops.csv``.

    Crops are clipped to their picture and widened to whole pixels; instances left without a pixel are skipped. The
    sources are never touched.
    """

    DIRECTORY_NAME: ClassVar[str] = "crops"
    TABLE_FILE_NAME: ClassVar[str] = "crops.csv"
    FORBIDDEN_CHARACTERS: ClassVar[str] = '/\\:*?"<>|'
    HEADER: ClassVar[tuple[str, ...]] = (
        "crop",
        "media",
        "frame",
        "seconds",
        "class",
        "matched_prompt",
        "confidence",
        "x_min",
        "y_min",
        "x_max",
        "y_max",
        "crop_x_min",
        "crop_y_min",
        "crop_x_max",
        "crop_y_max",
    )

    def __init__(self, crop_options: CropOptions, is_confidence_included: bool) -> None:
        """
        Parameters
        ----------
        crop_options : CropOptions
            Image format and margin of the crops.
        is_confidence_included : bool
            Whether ``crops.csv`` carries the confidences.
        """
        self._crop_options: CropOptions = crop_options
        self._is_confidence_included: bool = is_confidence_included

    def write(self, items: Sequence[ExportItem], media: Mapping[Path, MediaItem], directory: Path) -> tuple[Path, ...]:
        """
        Crop and save the instances.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures.
        media : Mapping[Path, MediaItem]
            Open media, telling videos apart.
        directory : Path
            Output directory.

        Returns
        -------
        tuple[Path, ...]
            Written crops followed by ``crops.csv``.
        """
        by_key: dict[FrameKey, ExportItem] = {item.frame_key: item for item in items}
        ordered: list[FrameKey] = sorted(by_key, key=FrameKey.sort_key)
        crop_directory: Path = directory / self.DIRECTORY_NAME
        written: list[Path] = []
        rows: list[tuple[str, ...]] = []
        used_names: set[str] = set()
        for loaded in PictureLoader(dict(media)).load(ordered):
            picture: Image.Image | Exception = loaded.image_or_error
            if isinstance(picture, Exception):
                continue
            item: ExportItem = by_key[loaded.frame_key]
            for number, instance in enumerate(item.result.instances, start=1):
                region: PixelBox | None = self._crop_options.pixel_region(instance.box, picture.width, picture.height)
                if region is None:
                    continue
                folder: Path = crop_directory / self._folder_name(instance.class_name)
                folder.mkdir(parents=True, exist_ok=True)
                target: Path = folder / self._unique_name(loaded.frame_key, number, folder, used_names)
                self._crop_options.image_format.save(picture.crop(region.xyxy), target)
                written.append(target)
                rows.append(self._row(target.relative_to(directory), item, instance, region))
        table_path: Path = directory / self.TABLE_FILE_NAME
        with table_path.open("w", encoding="utf-8", newline="") as table_file:
            writer = csv.writer(table_file)
            writer.writerow(self.HEADER)
            writer.writerows(rows)
        written.append(table_path)
        return tuple(written)

    def _row(
        self, crop_path: Path, item: ExportItem, instance: RecognizedInstance, region: PixelBox
    ) -> tuple[str, ...]:
        frame_index: int | None = item.frame_key.frame_index
        return (
            crop_path.as_posix(),
            str(item.frame_key.path),
            "" if frame_index is None else str(frame_index),
            "" if item.seconds is None else f"{item.seconds:.3f}",
            instance.class_name,
            instance.matched_prompt,
            f"{instance.confidence:.6f}" if self._is_confidence_included else "",
            *(f"{value:.2f}" for value in instance.box.xyxy),
            *(f"{value:.0f}" for value in region.xyxy),
        )

    def _unique_name(self, frame_key: FrameKey, number: int, folder: Path, used_names: set[str]) -> str:
        stem: str = (
            frame_key.path.stem
            if frame_key.frame_index is None
            else f"{frame_key.path.stem}_f{frame_key.frame_index:06d}"
        )
        base: str = f"{stem}_{number:03d}"
        suffix: str = self._crop_options.image_format.suffix
        name: str = f"{base}{suffix}"
        duplicate: int = 1
        while f"{folder.name}/{name}".casefold() in used_names:
            duplicate += 1
            name = f"{base}_{duplicate}{suffix}"
        used_names.add(f"{folder.name}/{name}".casefold())
        return name

    @classmethod
    def _folder_name(cls, class_name: str) -> str:
        cleaned: str = "".join("_" if character in cls.FORBIDDEN_CHARACTERS else character for character in class_name)
        return cleaned.strip(". ") or "_"
