from pathlib import Path
from typing import ClassVar

from ..media import InferenceMode
from ..models import ComputeDevice, ComputePrecision, ModelSelection, TemplateCombination
from ..recognition import RecognitionTask
from .json_fields import JsonFields, JsonValue
from .json_file import JsonFile
from .session import Session
from .session_media import SessionMedia
from .session_task_settings import SessionTaskSettings


class SessionStore:
    """
    Open media, shown picture, sampling, inference and model choices of each task and the chosen task, remembered in
    ``session.json`` of a data directory.

    Parts that cannot be read are dropped one by one, so a preset removed from a library loses only its selection.
    A file of the earlier format, holding one media list for all tasks, gives that list to its stored task; one holding
    a single sampling and inference choice gives it to every task.
    The directory is created only when written to.
    """

    FILE_NAME: ClassVar[str] = "session.json"

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
        File holding the session.

        Returns
        -------
        Path
            ``session.json`` in the data directory, whether or not it exists.
        """
        return self._file.path

    def load(self) -> Session:
        """
        Read the remembered session.

        Returns
        -------
        Session
            Stored session, or an empty one when nothing is stored or the file is unreadable.
        """
        content: dict[str, JsonValue] | None = self._file.read_object("session")
        if content is None:
            return Session()
        try:
            task_value: JsonValue = content.get("task")
            task: RecognitionTask | None = (
                None if task_value is None else RecognitionTask(JsonFields.string_of(task_value, "task"))
            )
            return Session(
                media=self._media_of(content, task),
                task=task,
                task_settings=self._task_settings_by_task_of(content),
                selections=self._selections_of(content.get("selections", [])),
            )
        except (TypeError, ValueError):
            return Session()

    def save(self, session: Session) -> None:
        """
        Remember a session for the next run.

        Parameters
        ----------
        session : Session
            State to store.

        Raises
        ------
        OSError
            If the data directory or the file cannot be written.
        """
        content: dict[str, JsonValue] = {
            "media": {task.value: self._media_content(media) for task, media in session.media.items()},
            "task": None if session.task is None else session.task.value,
            "task_settings": {
                task.value: self._task_settings_content(settings) for task, settings in session.task_settings.items()
            },
            "selections": [self._selection_content(selection) for selection in session.selections.values()],
        }
        self._file.write(content)

    @staticmethod
    def _task_settings_content(settings: SessionTaskSettings) -> JsonValue:
        return {
            "frame_step": settings.frame_step,
            "inference_mode": None if settings.inference_mode is None else settings.inference_mode.value,
            "is_auto_inference": settings.is_auto_inference,
        }

    @classmethod
    def _task_settings_by_task_of(cls, content: dict[str, JsonValue]) -> dict[RecognitionTask, SessionTaskSettings]:
        value: JsonValue = content.get("task_settings")
        if value is None:
            shared: SessionTaskSettings = cls._task_settings_of(content)
            return {} if shared == SessionTaskSettings() else dict.fromkeys(RecognitionTask, shared)
        settings_by_task: dict[RecognitionTask, SessionTaskSettings] = {}
        for task_name, entry in JsonFields.object_of(value, "task_settings").items():
            try:
                settings_by_task[RecognitionTask(task_name)] = cls._task_settings_of(
                    JsonFields.object_of(entry, "task settings")
                )
            except (TypeError, ValueError):
                continue
        return settings_by_task

    @staticmethod
    def _task_settings_of(content: dict[str, JsonValue]) -> SessionTaskSettings:
        step_value: JsonValue = content.get("frame_step")
        mode_value: JsonValue = content.get("inference_mode")
        auto_value: JsonValue = content.get("is_auto_inference")
        return SessionTaskSettings(
            frame_step=None if step_value is None else JsonFields.integer_of(step_value, "frame_step"),
            inference_mode=(
                None if mode_value is None else InferenceMode.parsed(JsonFields.string_of(mode_value, "inference_mode"))
            ),
            is_auto_inference=None if auto_value is None else JsonFields.boolean_of(auto_value, "is_auto_inference"),
        )

    @staticmethod
    def _media_content(media: SessionMedia) -> JsonValue:
        return {
            "paths": [str(media_path) for media_path in media.paths],
            "current": None if media.current_path is None else str(media.current_path),
            "frame": media.current_frame_index,
        }

    @classmethod
    def _media_of(
        cls, content: dict[str, JsonValue], task: RecognitionTask | None
    ) -> dict[RecognitionTask, SessionMedia]:
        value: JsonValue = content.get("media", {})
        if isinstance(value, list):
            if task is None:
                return {}
            return {
                task: cls._task_media_of(
                    {"paths": value, "current": content.get("current"), "frame": content.get("frame")}
                )
            }
        media: dict[RecognitionTask, SessionMedia] = {}
        for task_name, entry in JsonFields.object_of(value, "media").items():
            try:
                media[RecognitionTask(task_name)] = cls._task_media_of(JsonFields.object_of(entry, "task media"))
            except (TypeError, ValueError):
                continue
        return media

    @staticmethod
    def _task_media_of(content: dict[str, JsonValue]) -> SessionMedia:
        paths: tuple[Path, ...] = tuple(
            Path(JsonFields.string_of(media_path, "media path"))
            for media_path in JsonFields.list_of(content.get("paths", []), "media paths")
        )
        current_value: JsonValue = content.get("current")
        current_path: Path | None = (
            None if current_value is None else Path(JsonFields.string_of(current_value, "current"))
        )
        frame_value: JsonValue = content.get("frame")
        return SessionMedia(
            paths=paths,
            current_path=current_path if current_path in paths else None,
            current_frame_index=None if frame_value is None else JsonFields.integer_of(frame_value, "frame"),
        )

    @staticmethod
    def _selection_content(selection: ModelSelection) -> JsonValue:
        return {
            "task": selection.task.value,
            "backend": selection.backend,
            "preset": selection.preset_name,
            "device": selection.device.value,
            "precision": selection.precision.value,
            "confidence": selection.confidence_threshold,
            "nms": selection.nms_iou_threshold,
            "pooling": selection.image_pooling,
            "box_detector": selection.box_detector_label,
            "tiling": selection.tiling_grid_size,
            "templates": None if selection.text_templates is None else list[JsonValue](selection.text_templates),
            "combination": None if selection.template_combination is None else selection.template_combination.value,
            "batch_size": selection.batch_size,
        }

    @classmethod
    def _selections_of(cls, value: JsonValue) -> dict[RecognitionTask, ModelSelection]:
        selections: dict[RecognitionTask, ModelSelection] = {}
        for entry in JsonFields.list_of(value, "selections"):
            try:
                selection: ModelSelection = cls._selection_of(JsonFields.object_of(entry, "selection"))
            except (TypeError, ValueError):
                continue
            selections[selection.task] = selection
        return selections

    @staticmethod
    def _selection_of(content: dict[str, JsonValue]) -> ModelSelection:
        def optional_number(key: str) -> float | None:
            raw: JsonValue = content.get(key)
            return None if raw is None else JsonFields.number_of(raw, key)

        def optional_string(key: str) -> str | None:
            raw: JsonValue = content.get(key)
            return None if raw is None else JsonFields.string_of(raw, key)

        return ModelSelection(
            task=RecognitionTask(JsonFields.string_of(content.get("task"), "task")),
            backend=JsonFields.string_of(content.get("backend"), "backend"),
            preset_name=JsonFields.string_of(content.get("preset"), "preset"),
            device=ComputeDevice(JsonFields.string_of(content.get("device"), "device")),
            precision=ComputePrecision(JsonFields.string_of(content.get("precision"), "precision")),
            confidence_threshold=optional_number("confidence"),
            nms_iou_threshold=optional_number("nms"),
            image_pooling=optional_string("pooling"),
            box_detector_label=optional_string("box_detector"),
            tiling_grid_size=None
            if content.get("tiling") is None
            else JsonFields.integer_of(content.get("tiling"), "tiling"),
            text_templates=None
            if content.get("templates") is None
            else tuple(
                JsonFields.string_of(template, "template")
                for template in JsonFields.list_of(content.get("templates"), "templates")
            ),
            template_combination=None
            if content.get("combination") is None
            else TemplateCombination(JsonFields.string_of(content.get("combination"), "combination")),
            batch_size=None
            if content.get("batch_size") is None
            else JsonFields.integer_of(content.get("batch_size"), "batch_size"),
        )
