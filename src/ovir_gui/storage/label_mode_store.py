from pathlib import Path
from typing import ClassVar

from ..review import LabelModeChoice
from .json_fields import JsonFields, JsonValue
from .json_file import JsonFile


class LabelModeStore:
    """
    Label mode chosen for the review of classifications, remembered between runs in ``label_mode.json`` of a data
    directory.

    The file looks like ``{"classification": "multi_label"}``. The directory is created only when written to.
    """

    FILE_NAME: ClassVar[str] = "label_mode.json"
    KEY: ClassVar[str] = "classification"

    def __init__(self, root_directory: Path) -> None:
        """
        Parameters
        ----------
        root_directory : Path
            Data directory holding the file.
        """
        self._file: JsonFile = JsonFile(root_directory / self.FILE_NAME)

    @property
    def path(self) -> Path:
        """
        File holding the label mode.

        Returns
        -------
        Path
            ``label_mode.json`` in the data directory, whether or not it exists.
        """
        return self._file.path

    def load(self) -> LabelModeChoice:
        """
        Read the remembered label mode.

        Returns
        -------
        LabelModeChoice
            Remembered mode; automatic when none is stored or it cannot be read.
        """
        content: dict[str, JsonValue] | None = self._file.read_object("label mode")
        if content is None or self.KEY not in content:
            return LabelModeChoice.AUTOMATIC
        try:
            return LabelModeChoice(JsonFields.string_of(content[self.KEY], self.KEY))
        except (TypeError, ValueError):
            return LabelModeChoice.AUTOMATIC

    def save(self, label_mode: LabelModeChoice) -> None:
        """
        Remember the label mode for the next run.

        Parameters
        ----------
        label_mode : LabelModeChoice
            Chosen mode.

        Raises
        ------
        OSError
            If the data directory or the file cannot be written.
        """
        self._file.write({self.KEY: label_mode.value})
