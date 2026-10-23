from collections.abc import Callable, Mapping
from pathlib import Path

from ..recognition import RecognitionTask
from .json_fields import JsonFields, JsonValue
from .json_file import JsonFile


class TaskSettingsFile[SettingsT]:
    """
    JSON file holding one object of settings per task, keyed by the task value.

    Every task is read on its own: a task whose entry is missing or cannot be read keeps its default.
    """

    def __init__(
        self,
        path: Path,
        description: str,
        settings_of: Callable[[dict[str, JsonValue]], SettingsT],
        content_of: Callable[[SettingsT], JsonValue],
    ) -> None:
        """
        Parameters
        ----------
        path : Path
            Location of the file.
        description : str
            What the file holds, used in error messages of the field checks.
        settings_of : Callable[[dict[str, JsonValue]], SettingsT]
            Settings of one task entry, raising ``TypeError`` or ``ValueError`` when it cannot be read.
        content_of : Callable[[SettingsT], JsonValue]
            Entry storing the settings of one task.
        """
        self._file: JsonFile = JsonFile(path)
        self._description: str = description
        self._settings_of: Callable[[dict[str, JsonValue]], SettingsT] = settings_of
        self._content_of: Callable[[SettingsT], JsonValue] = content_of

    @property
    def path(self) -> Path:
        """
        Location of the file.

        Returns
        -------
        Path
            Path given at construction, whether or not it exists.
        """
        return self._file.path

    def load(self, defaults: Mapping[RecognitionTask, SettingsT]) -> dict[RecognitionTask, SettingsT]:
        """
        Read the settings of every task.

        Parameters
        ----------
        defaults : Mapping[RecognitionTask, SettingsT]
            Settings of the tasks without a readable entry.

        Returns
        -------
        dict[RecognitionTask, SettingsT]
            ``defaults`` with every readable entry of the file in place of its default.
        """
        settings: dict[RecognitionTask, SettingsT] = dict(defaults)
        content: dict[str, JsonValue] | None = self._file.read_object(self._description)
        if content is None:
            return settings
        for task in RecognitionTask:
            entry: JsonValue = content.get(task.value)
            if entry is None:
                continue
            try:
                settings[task] = self._settings_of(JsonFields.object_of(entry, task.value))
            except (TypeError, ValueError):
                continue
        return settings

    def save(self, settings: Mapping[RecognitionTask, SettingsT]) -> None:
        """
        Replace the file with the settings of some tasks.

        Parameters
        ----------
        settings : Mapping[RecognitionTask, SettingsT]
            Settings by task, written in mapping order.

        Raises
        ------
        OSError
            If the directory or the file cannot be written.
        """
        self._file.write({task.value: self._content_of(task_settings) for task, task_settings in settings.items()})
