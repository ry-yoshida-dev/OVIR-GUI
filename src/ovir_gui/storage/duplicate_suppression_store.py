import json
from collections.abc import Mapping
from pathlib import Path
from typing import ClassVar

from ..recognition import RecognitionTask
from ..review import DuplicateSuppression
from .json_fields import JsonFields, JsonValue


class DuplicateSuppressionStore:
    """
    Review suppression of duplicates per task, remembered between runs in ``duplicate_suppression.json`` of a data
    directory.

    The file looks like ``{"detection": {"enabled": true, "overlap": 0.5, "classes": {"car": 0.7}}}``. The directory
    is created only when written to.
    """

    FILE_NAME: ClassVar[str] = "duplicate_suppression.json"

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
        File holding the suppressions.

        Returns
        -------
        Path
            ``duplicate_suppression.json`` in the data directory, whether or not it exists.
        """
        return self._root_directory / self.FILE_NAME

    def load(self) -> dict[RecognitionTask, DuplicateSuppression]:
        """
        Read the remembered suppressions.

        Returns
        -------
        dict[RecognitionTask, DuplicateSuppression]
            Suppression of every task; a task without a stored one keeps every box.
        """
        suppressions: dict[RecognitionTask, DuplicateSuppression] = {
            task: DuplicateSuppression() for task in RecognitionTask
        }
        if not self.path.is_file():
            return suppressions
        try:
            content: dict[str, JsonValue] = JsonFields.object_of(
                JsonFields.parse(self.path.read_text(encoding="utf-8")), "suppressions"
            )
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, TypeError):
            return suppressions
        for task in RecognitionTask:
            entry: JsonValue = content.get(task.value)
            if entry is None:
                continue
            try:
                task_content: dict[str, JsonValue] = JsonFields.object_of(entry, task.value)
                class_overlaps: dict[str, JsonValue] = JsonFields.object_of(task_content.get("classes", {}), "classes")
                suppressions[task] = DuplicateSuppression(
                    JsonFields.boolean_of(task_content.get("enabled", False), "enabled"),
                    JsonFields.number_of(
                        task_content.get("overlap", DuplicateSuppression.DEFAULT_OVERLAP_THRESHOLD), "overlap"
                    ),
                    {
                        class_name: JsonFields.number_of(overlap, class_name)
                        for class_name, overlap in class_overlaps.items()
                    },
                )
            except (TypeError, ValueError):
                continue
        return suppressions

    def save(self, suppressions: Mapping[RecognitionTask, DuplicateSuppression]) -> None:
        """
        Remember the suppressions for the next run.

        Parameters
        ----------
        suppressions : Mapping[RecognitionTask, DuplicateSuppression]
            Suppression of every task.

        Raises
        ------
        OSError
            If the data directory or the file cannot be written.
        """
        content: dict[str, JsonValue] = {
            task.value: {
                "enabled": suppression.is_enabled,
                "overlap": suppression.overlap_threshold,
                "classes": dict(suppression.class_overlap_thresholds),
            }
            for task, suppression in suppressions.items()
        }
        self._root_directory.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
