from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

import numpy as np
from PIL import Image

from ..recognition.array_types import BoolArray
from .export_item import ExportItem
from .picture_files import PictureFiles


class MaskImageWriter:
    """
    Writes label maps of exported instances as PNG images.

    ``masks/<stem>_classes.png`` holds the class of every pixel (class id + 1, 0 for background, 8-bit) and
    ``masks/<stem>_instances.png`` the instance (1-based, 0 for background, 16-bit); where instances overlap, the
    more confident one wins. ``classes.txt`` lists the classes in id order.
    """

    MASK_DIRECTORY_NAME: ClassVar[str] = "masks"
    CLASSES_FILE_NAME: ClassVar[str] = "classes.txt"

    def write(
        self, items: Sequence[ExportItem], pictures: PictureFiles, class_names: Sequence[str], directory: Path
    ) -> tuple[Path, ...]:
        """
        Write the label maps.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures.
        pictures : PictureFiles
            Image file of every picture, naming its maps.
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
            If more than 255 classes are exported.
        """
        names: list[str] = list(class_names)
        for item in items:
            for instance in item.result.instances:
                if instance.class_name not in names:
                    names.append(instance.class_name)
        if len(names) > 255:
            raise ValueError("class maps hold at most 255 classes.")
        mask_directory: Path = directory / self.MASK_DIRECTORY_NAME
        mask_directory.mkdir(parents=True, exist_ok=True)
        written: list[Path] = []
        for item in items:
            picture_path: Path | None = pictures.path_of(item.frame_key)
            if picture_path is None:
                continue
            width: int = item.result.image_size.width
            height: int = item.result.image_size.height
            class_map: np.ndarray = np.zeros((height, width), dtype=np.uint8)
            instance_map: np.ndarray = np.zeros((height, width), dtype=np.uint16)
            order: list[int] = sorted(
                range(len(item.result.instances)), key=lambda index: item.result.instances[index].confidence
            )
            for index in order:
                instance = item.result.instances[index]
                if instance.mask is None:
                    continue
                region: BoolArray = instance.mask.dense(width, height)
                class_map[region] = names.index(instance.class_name) + 1
                instance_map[region] = index + 1
            class_path: Path = mask_directory / f"{picture_path.stem}_classes.png"
            instance_path: Path = mask_directory / f"{picture_path.stem}_instances.png"
            Image.fromarray(class_map, mode="L").save(class_path)
            Image.fromarray(instance_map).save(instance_path)
            written.extend((class_path, instance_path))
        classes_path: Path = directory / self.CLASSES_FILE_NAME
        classes_path.write_text("".join(f"{name}\n" for name in names), encoding="utf-8")
        written.append(classes_path)
        return tuple(written)
