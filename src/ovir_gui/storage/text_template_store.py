from pathlib import Path
from typing import ClassVar

from .json_fields import JsonFields, JsonValue
from .json_file import JsonFile


class TextTemplateStore:
    """
    Text templates saved for reuse by classifiers, remembered between runs in ``text_templates.json`` of a data
    directory.

    The file looks like ``{"templates": ["a photo of a {}.", "a CCTV image of a {}."]}``. The directory is created
    only when written to.
    """

    FILE_NAME: ClassVar[str] = "text_templates.json"
    KEY: ClassVar[str] = "templates"

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
        File holding the templates.

        Returns
        -------
        Path
            ``text_templates.json`` in the data directory, whether or not it exists.
        """
        return self._file.path

    def load(self) -> tuple[str, ...] | None:
        """
        Read the saved templates.

        Returns
        -------
        tuple[str, ...] | None
            Saved templates in their order; ``None`` when none were ever saved or the file cannot be read.
        """
        content: dict[str, JsonValue] | None = self._file.read_object("text templates")
        if content is None or self.KEY not in content:
            return None
        try:
            listed: list[JsonValue] = JsonFields.list_of(content[self.KEY], self.KEY)
            return tuple(JsonFields.string_of(template, "template") for template in listed)
        except TypeError:
            return None

    def save(self, templates: tuple[str, ...]) -> None:
        """
        Remember the templates for the next run.

        Parameters
        ----------
        templates : tuple[str, ...]
            Saved templates in their order.

        Raises
        ------
        OSError
            If the data directory or the file cannot be written.
        """
        self._file.write({self.KEY: list[JsonValue](templates)})
