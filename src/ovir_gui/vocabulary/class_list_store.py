from collections.abc import Iterable
from pathlib import Path
from typing import ClassVar

from .class_definition import ClassDefinition
from .class_list_file import ClassListFile


class ClassListStore:
    """
    Class list of the last run, remembered in a data directory, typically ``ovir_gui_data`` under the working directory.

    The list is kept in ``last_classes.txt`` so that it can be restored at the next start. The directory is created
    only when written to.
    """

    LAST_CLASSES_FILE_NAME: ClassVar[str] = "last_classes.txt"

    def __init__(self, root_directory: Path) -> None:
        """
        Parameters
        ----------
        root_directory : Path
            Data directory holding the remembered class list.
        """
        self._root_directory: Path = root_directory

    @property
    def root_directory(self) -> Path:
        """
        Data directory.

        Returns
        -------
        Path
            Directory given at construction.
        """
        return self._root_directory

    def load(self) -> tuple[ClassDefinition, ...] | None:
        """
        Read the class list remembered from the last run.

        Returns
        -------
        tuple[ClassDefinition, ...] | None
            Classes in class id order, or ``None`` when nothing has been remembered or the file is unreadable.
        """
        last_classes_file: ClassListFile = self._last_classes_file()
        if not last_classes_file.path.is_file():
            return None
        try:
            return last_classes_file.read()
        except (OSError, ValueError):
            return None

    def save(self, definitions: Iterable[ClassDefinition]) -> None:
        """
        Remember the class list for the next run.

        Parameters
        ----------
        definitions : Iterable[ClassDefinition]
            Classes in class id order.

        Raises
        ------
        OSError
            If the data directory or the file cannot be written.
        """
        self._root_directory.mkdir(parents=True, exist_ok=True)
        self._last_classes_file().write(definitions)

    def _last_classes_file(self) -> ClassListFile:
        return ClassListFile(self._root_directory / self.LAST_CLASSES_FILE_NAME)
