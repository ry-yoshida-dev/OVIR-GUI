from pathlib import Path
from typing import ClassVar

from ..prompting import ExemplarBox, ObjectMark, PicturePrompts
from .json_fields import JsonFields, JsonValue
from .json_file import JsonFile
from .picture_prompt_codec import PicturePromptCodec


class PicturePromptStore:
    """
    Exemplar boxes and object marks drawn on the pictures, remembered between runs in ``picture_prompts.json`` of a
    data directory.

    The file looks like ``{"exemplars": [...], "marks": [...]}`` in the form of ``PicturePromptCodec``. Entries that
    cannot be read are dropped one by one. The directory is created only when written to.
    """

    FILE_NAME: ClassVar[str] = "picture_prompts.json"

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
        File holding the drawings.

        Returns
        -------
        Path
            ``picture_prompts.json`` in the data directory, whether or not it exists.
        """
        return self._file.path

    def load(self) -> PicturePrompts:
        """
        Read the remembered drawings.

        Returns
        -------
        PicturePrompts
            Every readable drawing; empty without a readable file.
        """
        content: dict[str, JsonValue] | None = self._file.read_object("picture prompts")
        if content is None:
            return PicturePrompts()
        try:
            exemplar_values: list[JsonValue] = JsonFields.list_of(content.get("exemplars", []), "exemplars")
            mark_values: list[JsonValue] = JsonFields.list_of(content.get("marks", []), "marks")
        except TypeError:
            return PicturePrompts()
        exemplars: list[ExemplarBox] = []
        for value in exemplar_values:
            try:
                exemplars.append(PicturePromptCodec.exemplar_of(value))
            except (TypeError, ValueError):
                continue
        marks: dict[tuple[str, int | None, int], ObjectMark] = {}
        for value in mark_values:
            try:
                mark: ObjectMark = PicturePromptCodec.mark_of(value)
            except (TypeError, ValueError):
                continue
            marks[(str(mark.frame_key.path), mark.frame_key.frame_index, mark.object_id)] = mark
        return PicturePrompts(exemplars=tuple(exemplars), marks=tuple(marks.values()))

    def save(self, prompts: PicturePrompts) -> None:
        """
        Remember the drawings for the next run.

        Parameters
        ----------
        prompts : PicturePrompts
            Every drawing.

        Raises
        ------
        OSError
            If the data directory or the file cannot be written.
        """
        content: dict[str, JsonValue] = {
            "exemplars": [PicturePromptCodec.exemplar_entry(box) for box in prompts.exemplars],
            "marks": [PicturePromptCodec.mark_entry(mark) for mark in prompts.marks],
        }
        self._file.write(content)
