from collections.abc import Mapping
from pathlib import Path
from typing import ClassVar

from ..recognition import RecognitionTask
from ..review import ClassThresholds
from .json_fields import JsonFields, JsonValue
from .task_settings_file import TaskSettingsFile


class ClassThresholdStore:
    """
    Minimum confidence per class and task, remembered between runs in ``class_thresholds.json`` of a data directory.

    Classifier scores and detection confidences follow different scales, so every task keeps its own minimums. The
    file looks like ``{"detection": {"default": 0.0, "classes": {"car": 0.35}, "prompts": {"car": {"suv": 0.5}}}}``.
    The directory is created only when written to. Detectors and segmenters keep findings down to a low floor, so the
    default minimum of those tasks starts at ``FINDING_DEFAULT_MINIMUM`` instead of keeping every finding.
    """

    FILE_NAME: ClassVar[str] = "class_thresholds.json"
    FINDING_DEFAULT_MINIMUM: ClassVar[float] = 0.25

    def __init__(self, root_directory: Path) -> None:
        """
        Parameters
        ----------
        root_directory : Path
            Data directory holding the file.
        """
        self._file: TaskSettingsFile[ClassThresholds] = TaskSettingsFile(
            root_directory / self.FILE_NAME, "thresholds", self._thresholds_of, self._content_of
        )

    @property
    def path(self) -> Path:
        """
        File holding the thresholds.

        Returns
        -------
        Path
            ``class_thresholds.json`` in the data directory, whether or not it exists.
        """
        return self._file.path

    def load(self) -> dict[RecognitionTask, ClassThresholds]:
        """
        Read the remembered thresholds.

        Returns
        -------
        dict[RecognitionTask, ClassThresholds]
            Thresholds of every task; a task without stored thresholds starts from its default minimum.
        """
        return self._file.load({task: ClassThresholds(self.default_minimum_of(task)) for task in RecognitionTask})

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
        self._file.save(thresholds)

    @classmethod
    def default_minimum_of(cls, task: RecognitionTask) -> float:
        """
        Default minimum a task starts from before the user changes it.

        Parameters
        ----------
        task : RecognitionTask
            Task to look up.

        Returns
        -------
        float
            ``FINDING_DEFAULT_MINIMUM`` for detection and segmentation, 0 for classification.
        """
        match task:
            case RecognitionTask.DETECTION | RecognitionTask.SEGMENTATION:
                return cls.FINDING_DEFAULT_MINIMUM
            case RecognitionTask.CLASSIFICATION:
                return 0.0

    @staticmethod
    def _thresholds_of(content: dict[str, JsonValue]) -> ClassThresholds:
        class_minimums: dict[str, JsonValue] = JsonFields.object_of(content.get("classes", {}), "classes")
        prompt_minimums: dict[str, JsonValue] = JsonFields.object_of(content.get("prompts", {}), "prompts")
        return ClassThresholds(
            JsonFields.number_of(content.get("default", 0.0), "default"),
            {class_name: JsonFields.number_of(minimum, class_name) for class_name, minimum in class_minimums.items()},
            {
                class_name: {
                    prompt: JsonFields.number_of(minimum, prompt)
                    for prompt, minimum in JsonFields.object_of(by_prompt, class_name).items()
                }
                for class_name, by_prompt in prompt_minimums.items()
            },
        )

    @staticmethod
    def _content_of(thresholds: ClassThresholds) -> JsonValue:
        return {
            "default": thresholds.default_minimum,
            "classes": dict(thresholds.class_minimums),
            "prompts": {class_name: dict(by_prompt) for class_name, by_prompt in thresholds.prompt_minimums.items()},
        }
