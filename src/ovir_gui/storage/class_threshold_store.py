import json
from collections.abc import Mapping
from pathlib import Path
from typing import ClassVar

from ..recognition import RecognitionTask
from ..review import ClassThresholds
from .json_fields import JsonFields, JsonValue


class ClassThresholdStore:
    """
    Minimum confidence per class and task, remembered between runs in ``class_thresholds.json`` of a data directory.

    Classifier scores and detection confidences follow different scales, so every task keeps its own minimums. The
    file looks like ``{"detection": {"default": 0.0, "classes": {"car": 0.35}}}``. The directory is created only
    when written to.
    """

    FILE_NAME: ClassVar[str] = "class_thresholds.json"

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
        File holding the thresholds.

        Returns
        -------
        Path
            ``class_thresholds.json`` in the data directory, whether or not it exists.
        """
        return self._root_directory / self.FILE_NAME

    def load(self) -> dict[RecognitionTask, ClassThresholds]:
        """
        Read the remembered thresholds.

        Returns
        -------
        dict[RecognitionTask, ClassThresholds]
            Thresholds of every task; a task without stored thresholds keeps every finding.
        """
        thresholds: dict[RecognitionTask, ClassThresholds] = {task: ClassThresholds() for task in RecognitionTask}
        if not self.path.is_file():
            return thresholds
        try:
            content: dict[str, JsonValue] = JsonFields.object_of(
                JsonFields.parse(self.path.read_text(encoding="utf-8")), "thresholds"
            )
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, TypeError):
            return thresholds
        for task in RecognitionTask:
            entry: JsonValue = content.get(task.value)
            if entry is None:
                continue
            try:
                task_content: dict[str, JsonValue] = JsonFields.object_of(entry, task.value)
                class_minimums: dict[str, JsonValue] = JsonFields.object_of(task_content.get("classes", {}), "classes")
                thresholds[task] = ClassThresholds(
                    JsonFields.number_of(task_content.get("default", 0.0), "default"),
                    {
                        class_name: JsonFields.number_of(minimum, class_name)
                        for class_name, minimum in class_minimums.items()
                    },
                )
            except (TypeError, ValueError):
                continue
        return thresholds

    def save(self, thresholds: Mapping[RecognitionTask, ClassThresholds]) -> None:
        """
        Remember the thresholds for the next run.

        Parameters
        ----------
        thresholds : Mapping[RecognitionTask, ClassThresholds]
            Thresholds of every task.

        Raises
        ------
        OSError
            If the data directory or the file cannot be written.
        """
        content: dict[str, JsonValue] = {
            task.value: {
                "default": task_thresholds.default_minimum,
                "classes": dict(task_thresholds.class_minimums),
            }
            for task, task_thresholds in thresholds.items()
        }
        self._root_directory.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
