from collections.abc import Mapping
from pathlib import Path
from typing import ClassVar

from ..prompting import ExemplarBox, ObjectMark, PicturePrompts
from ..recognition import RecognitionTask
from .json_fields import JsonFields, JsonValue
from .picture_prompt_codec import PicturePromptCodec
from .task_settings_file import TaskSettingsFile


class PicturePromptStore:
    """
    Exemplar boxes and object marks drawn on the pictures for every task, remembered between runs in
    ``picture_prompts.json`` of a data directory.

    The file looks like ``{"segmentation": {"exemplars": [...], "marks": [...]}}`` in the form of
    ``PicturePromptCodec``. Entries that cannot be read are dropped one by one. The directory is created only when
    written to.
    """

    FILE_NAME: ClassVar[str] = "picture_prompts.json"

    def __init__(self, root_directory: Path) -> None:
        """
        Parameters
        ----------
        root_directory : Path
            Data directory holding the file.
        """
        self._file: TaskSettingsFile[PicturePrompts] = TaskSettingsFile(
            root_directory / self.FILE_NAME, "picture prompts", self._prompts_of, self._content_of
        )

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

    def load(self) -> dict[RecognitionTask, PicturePrompts]:
        """
        Read the remembered drawings.

        Returns
        -------
        dict[RecognitionTask, PicturePrompts]
            Every readable drawing of every task; empty for a task without a readable entry.
        """
        return self._file.load({task: PicturePrompts() for task in RecognitionTask})

    def save(self, prompts: Mapping[RecognitionTask, PicturePrompts]) -> None:
        """
        Remember the drawings for the next run.

        Parameters
        ----------
        prompts : Mapping[RecognitionTask, PicturePrompts]
            Every drawing per task.

        Raises
        ------
        OSError
            If the data directory or the file cannot be written.
        """
        self._file.save(prompts)

    @staticmethod
    def _prompts_of(content: dict[str, JsonValue]) -> PicturePrompts:
        exemplar_values: list[JsonValue] = JsonFields.list_of(content.get("exemplars", []), "exemplars")
        mark_values: list[JsonValue] = JsonFields.list_of(content.get("marks", []), "marks")
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

    @staticmethod
    def _content_of(prompts: PicturePrompts) -> JsonValue:
        return {
            "exemplars": [PicturePromptCodec.exemplar_entry(box) for box in prompts.exemplars],
            "marks": [PicturePromptCodec.mark_entry(mark) for mark in prompts.marks],
        }
