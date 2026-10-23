import json
from pathlib import Path
from typing import ClassVar

from ..media import InferenceMode
from ..models import ComputeDevice, ComputePrecision, ModelSelection
from ..recognition import RecognitionTask
from .json_fields import JsonFields, JsonValue
from .session import Session


class SessionStore:
    """
    Open media, shown picture, task, sampling and model choices remembered in ``session.json`` of a data directory.

    Parts that cannot be read are dropped one by one, so a preset removed from a library loses only its selection.
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
        self._root_directory: Path = root_directory

    @property
    def path(self) -> Path:
        """
        File holding the session.

        Returns
        -------
        Path
            ``session.json`` in the data directory, whether or not it exists.
        """
        return self._root_directory / self.FILE_NAME

    def load(self) -> Session:
        """
        Read the remembered session.

        Returns
        -------
        Session
            Stored session, or an empty one when nothing is stored or the file is unreadable.
        """
        if not self.path.is_file():
            return Session()
        try:
            content: dict[str, JsonValue] = JsonFields.object_of(
                JsonFields.parse(self.path.read_text(encoding="utf-8")), "session"
            )
            media_paths: tuple[Path, ...] = tuple(
                Path(JsonFields.string_of(media_path, "media path"))
                for media_path in JsonFields.list_of(content.get("media", []), "media")
            )
            current_value: JsonValue = content.get("current")
            current_path: Path | None = (
                None if current_value is None else Path(JsonFields.string_of(current_value, "current"))
            )
            if current_path not in media_paths:
                current_path = None
            frame_value: JsonValue = content.get("frame")
            task_value: JsonValue = content.get("task")
            step_value: JsonValue = content.get("frame_step")
            mode_value: JsonValue = content.get("inference_mode")
            auto_value: JsonValue = content.get("is_auto_inference")
            return Session(
                media_paths=media_paths,
                current_path=current_path,
                current_frame_index=None if frame_value is None else JsonFields.integer_of(frame_value, "frame"),
                task=None if task_value is None else RecognitionTask(JsonFields.string_of(task_value, "task")),
                frame_step=None if step_value is None else JsonFields.integer_of(step_value, "frame_step"),
                inference_mode=(
                    None
                    if mode_value is None
                    else InferenceMode.parsed(JsonFields.string_of(mode_value, "inference_mode"))
                ),
                is_auto_inference=(
                    None if auto_value is None else JsonFields.boolean_of(auto_value, "is_auto_inference")
                ),
                selections=self._selections_of(content.get("selections", [])),
            )
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, TypeError, ValueError):
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
            "media": [str(media_path) for media_path in session.media_paths],
            "current": None if session.current_path is None else str(session.current_path),
            "frame": session.current_frame_index,
            "task": None if session.task is None else session.task.value,
            "frame_step": session.frame_step,
            "inference_mode": None if session.inference_mode is None else session.inference_mode.value,
            "is_auto_inference": session.is_auto_inference,
            "selections": [self._selection_content(selection) for selection in session.selections.values()],
        }
        self._root_directory.mkdir(parents=True, exist_ok=True)
        partial_path: Path = self.path.with_name(f".{self.FILE_NAME}.partial")
        partial_path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")
        partial_path.replace(self.path)

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
            batch_size=None
            if content.get("batch_size") is None
            else JsonFields.integer_of(content.get("batch_size"), "batch_size"),
        )
