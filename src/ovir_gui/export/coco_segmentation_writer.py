import json
from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

from ..storage import JsonValue
from .export_item import ExportItem
from .picture_files import PictureFiles


class CocoSegmentationWriter:
    """
    Writes exported instances as MS COCO instance segmentation, with every mask outlined by polygons.
    """

    FILE_NAME: ClassVar[str] = "annotations.json"

    def __init__(self, is_confidence_included: bool) -> None:
        """
        Parameters
        ----------
        is_confidence_included : bool
            Whether every annotation carries its ``score``.
        """
        self._is_confidence_included: bool = is_confidence_included

    def write(
        self, items: Sequence[ExportItem], pictures: PictureFiles, class_names: Sequence[str], directory: Path
    ) -> tuple[Path, ...]:
        """
        Write ``annotations.json``.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures.
        pictures : PictureFiles
            Image file of every picture.
        class_names : Sequence[str]
            Classes placed first in id order; classes only results report follow.
        directory : Path
            Output directory.

        Returns
        -------
        tuple[Path, ...]
            The written file.
        """
        names: list[str] = list(class_names)
        for item in items:
            for instance in item.result.instances:
                if instance.class_name not in names:
                    names.append(instance.class_name)
        images: list[JsonValue] = []
        annotations: list[JsonValue] = []
        for item in items:
            picture_path: Path | None = pictures.path_of(item.frame_key)
            if picture_path is None:
                continue
            image_id: int = len(images) + 1
            images.append(
                {
                    "id": image_id,
                    "file_name": self._relative_name(picture_path, directory),
                    "width": item.result.image_size.width,
                    "height": item.result.image_size.height,
                }
            )
            for instance in item.result.instances:
                left, top, right, bottom = instance.box.xyxy
                annotation: dict[str, JsonValue] = {
                    "id": len(annotations) + 1,
                    "image_id": image_id,
                    "category_id": names.index(instance.class_name) + 1,
                    "bbox": [left, top, right - left, bottom - top],
                    "area": float(instance.area),
                    "iscrowd": 0,
                    "segmentation": []
                    if instance.mask is None
                    else [
                        [coordinate for point in polygon for coordinate in point]
                        for polygon in instance.mask.polygons()
                    ],
                }
                if self._is_confidence_included:
                    annotation["score"] = instance.confidence
                annotations.append(annotation)
        document: dict[str, JsonValue] = {
            "images": images,
            "annotations": annotations,
            "categories": [{"id": index + 1, "name": name} for index, name in enumerate(names)],
        }
        directory.mkdir(parents=True, exist_ok=True)
        target: Path = directory / self.FILE_NAME
        target.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
        return (target,)

    @staticmethod
    def _relative_name(picture_path: Path, directory: Path) -> str:
        try:
            return picture_path.resolve().relative_to(directory.resolve()).as_posix()
        except ValueError:
            return str(picture_path)
