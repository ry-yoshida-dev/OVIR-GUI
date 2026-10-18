import shutil
from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

from .export_item import ExportItem
from .picture_files import PictureFiles


class ClassFolderWriter:
    """
    Copies every classified picture into a folder named after its exported class, ``_unlabeled`` without one.

    Copies of pictures sharing a file name get a numbered name; the sources are never touched.
    """

    UNLABELED_DIRECTORY_NAME: ClassVar[str] = "_unlabeled"
    FORBIDDEN_CHARACTERS: ClassVar[str] = '/\\:*?"<>|'

    def write(self, items: Sequence[ExportItem], pictures: PictureFiles, directory: Path) -> tuple[Path, ...]:
        """
        Copy the pictures.

        Parameters
        ----------
        items : Sequence[ExportItem]
            Exported pictures.
        pictures : PictureFiles
            Image file of every picture.
        directory : Path
            Output directory.

        Returns
        -------
        tuple[Path, ...]
            Written files.
        """
        written: list[Path] = []
        for item in items:
            source: Path | None = pictures.path_of(item.frame_key)
            if source is None:
                continue
            folder: Path = directory / (self._folder_name(item.label) if item.label else self.UNLABELED_DIRECTORY_NAME)
            folder.mkdir(parents=True, exist_ok=True)
            target: Path = folder / source.name
            number: int = 1
            while target.exists():
                number += 1
                target = folder / f"{source.stem}_{number}{source.suffix}"
            shutil.copyfile(source, target)
            written.append(target)
        return tuple(written)

    @classmethod
    def _folder_name(cls, label: str) -> str:
        cleaned: str = "".join("_" if character in cls.FORBIDDEN_CHARACTERS else character for character in label)
        return cleaned.strip(". ") or "_"
