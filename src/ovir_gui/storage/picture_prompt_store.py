import json
from pathlib import Path
from typing import ClassVar

from ..prompting import ExemplarBox, ObjectMark, PicturePrompts
from .json_fields import JsonFields, JsonValue
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
        self._root_directory: Path = root_directory

    @property
    def path(self) -> Path:
        """
        File holding the drawings.

        Returns
        -------
        Path
            ``picture_prompts.json`` in the data directory, whether or not it exists.
        """
        return self._root_directory / self.FILE_NAME

    def load(self) -> PicturePrompts:
        """
        Read the remembered drawings.

        Returns
        -------
        PicturePrompts
            Every readable drawing; empty without a readable file.
        """
        if not self.path.is_file():
            return PicturePrompts()
        try:
            content: dict[str, JsonValue] = JsonFields.object_of(
                JsonFields.parse(self.path.read_text(encoding="utf-8")), "picture prompts"
            )
            exemplar_values: list[JsonValue] = JsonFields.list_of(content.get("exemplars", []), "exemplars")
            mark_values: list[JsonValue] = JsonFields.list_of(content.get("marks", []), "marks")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, TypeError):
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
        self._root_directory.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
