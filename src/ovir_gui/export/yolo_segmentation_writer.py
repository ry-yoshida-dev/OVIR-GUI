from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

from .export_item import ExportItem
from .picture_files import PictureFiles


class YoloSegmentationWriter:
    """
    Writes exported instances as YOLO segmentation labels: one ``labels/<stem>.txt`` per picture with a line
    ``class x1 y1 x2 y2 ...`` per mask region in normalized coordinates, and ``classes.txt``.
    """

    LABEL_DIRECTORY_NAME: ClassVar[str] = "labels"
    CLASSES_FILE_NAME: ClassVar[str] = "classes.txt"

    def __init__(self, is_confidence_included: bool) -> None:
        """
        Parameters
        ----------
        is_confidence_included : bool
            Whether every line ends with the confidence of its instance.
        """
        self._is_confidence_included: bool = is_confidence_included

    def write(
        self, items: Sequence[ExportItem], pictures: PictureFiles, class_names: Sequence[str], directory: Path
    ) -> tuple[Path, ...]:
        """
        Write the label files.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures.
        pictures : PictureFiles
            Image file of every picture, naming its label file.
        class_names : Sequence[str]
            Classes placed first in id order.
        directory : Path
            Output directory.

        Returns
        -------
        tuple[Path, ...]
            Written files.

        Raises
        ------
        ValueError
            If two pictures share a file stem.
        """
        names: list[str] = list(class_names)
        for item in items:
            for instance in item.result.instances:
                if instance.class_name not in names:
                    names.append(instance.class_name)
        label_directory: Path = directory / self.LABEL_DIRECTORY_NAME
        label_directory.mkdir(parents=True, exist_ok=True)
        written: list[Path] = []
        used_stems: set[str] = set()
        for item in items:
            picture_path: Path | None = pictures.path_of(item.frame_key)
            if picture_path is None:
                continue
            if picture_path.stem in used_stems:
                raise ValueError(f"two pictures share the file stem {picture_path.stem}; YOLO labels would collide.")
            used_stems.add(picture_path.stem)
            width: float = float(item.result.image_size.width)
            height: float = float(item.result.image_size.height)
            lines: list[str] = []
            for instance in item.result.instances:
                if instance.mask is None:
                    continue
                for polygon in instance.mask.polygons():
                    coordinates: str = " ".join(f"{x / width:.6f} {y / height:.6f}" for x, y in polygon)
                    suffix: str = f" {instance.confidence:.6f}" if self._is_confidence_included else ""
                    lines.append(f"{names.index(instance.class_name)} {coordinates}{suffix}")
            target: Path = label_directory / f"{picture_path.stem}.txt"
            target.write_text("".join(f"{line}\n" for line in lines), encoding="utf-8")
            written.append(target)
        classes_path: Path = directory / self.CLASSES_FILE_NAME
        classes_path.write_text("".join(f"{name}\n" for name in names), encoding="utf-8")
        written.append(classes_path)
        return tuple(written)
