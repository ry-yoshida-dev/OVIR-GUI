from collections.abc import Mapping
from pathlib import Path
from typing import ClassVar

from ..recognition import RecognitionTask
from ..review import DuplicateSuppression
from .json_fields import JsonFields, JsonValue
from .task_settings_file import TaskSettingsFile


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
        self._file: TaskSettingsFile[DuplicateSuppression] = TaskSettingsFile(
            root_directory / self.FILE_NAME, "suppressions", self._suppression_of, self._content_of
        )

    @property
    def path(self) -> Path:
        """
        File holding the suppressions.

        Returns
        -------
        Path
            ``duplicate_suppression.json`` in the data directory, whether or not it exists.
        """
        return self._file.path

    def load(self) -> dict[RecognitionTask, DuplicateSuppression]:
        """
        Read the remembered suppressions.

        Returns
        -------
        dict[RecognitionTask, DuplicateSuppression]
            Suppression of every task; a task without a stored one keeps every box.
        """
        return self._file.load({task: DuplicateSuppression() for task in RecognitionTask})

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
        self._file.save(suppressions)

    @staticmethod
    def _suppression_of(content: dict[str, JsonValue]) -> DuplicateSuppression:
        class_overlaps: dict[str, JsonValue] = JsonFields.object_of(content.get("classes", {}), "classes")
        return DuplicateSuppression(
            JsonFields.boolean_of(content.get("enabled", False), "enabled"),
            JsonFields.number_of(content.get("overlap", DuplicateSuppression.DEFAULT_OVERLAP_THRESHOLD), "overlap"),
            {class_name: JsonFields.number_of(overlap, class_name) for class_name, overlap in class_overlaps.items()},
        )

    @staticmethod
    def _content_of(suppression: DuplicateSuppression) -> JsonValue:
        return {
            "enabled": suppression.is_enabled,
            "overlap": suppression.overlap_threshold,
            "classes": dict(suppression.class_overlap_thresholds),
        }
