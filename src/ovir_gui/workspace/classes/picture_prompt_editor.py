from collections.abc import Callable
from pathlib import Path

from ...inference import RecognitionModel
from ...media import FrameKey, MediaItem
from ...prompting import PicturePromptBoard
from ...storage import PicturePromptStore
from ..jobs.background_planner import BackgroundPlanner
from ..messages.status_notifier import StatusNotifier
from ..messages.topic import WorkspaceTopic
from ..recognition.settings import RecognitionSettings
from ..working_state import WorkingState
from .workbench import ClassWorkbench


class PicturePromptEditor:
    """
    Edits the exemplar boxes and object marks drawn on the pictures of the current task, with undo and redo per media
    file.

    Every change is remembered, and the shown picture is recognized again when automatic inference is on and the
    chosen model reads drawings on the picture it recognizes.
    """

    def __init__(
        self,
        working: WorkingState,
        settings: RecognitionSettings,
        workbench: ClassWorkbench,
        store: PicturePromptStore,
        planner: BackgroundPlanner,
        notifier: StatusNotifier,
        current_model: Callable[[], RecognitionModel],
        restart_background: Callable[[], None],
    ) -> None:
        """
        Parameters
        ----------
        working : WorkingState
            Open media and shown picture.
        settings : RecognitionSettings
            Whether inference is automatic.
        workbench : ClassWorkbench
            Drawings of every task.
        store : PicturePromptStore
            Data directory file remembering the drawings.
        planner : BackgroundPlanner
            Background recognition, unpinned to recognize the shown picture again.
        notifier : StatusNotifier
            Views told about the changed drawings.
        current_model : Callable[[], RecognitionModel]
            Model chosen for the current task.
        restart_background : Callable[[], None]
            Restarts background recognition after a change.
        """
        self._working: WorkingState = working
        self._settings: RecognitionSettings = settings
        self._workbench: ClassWorkbench = workbench
        self._store: PicturePromptStore = store
        self._planner: BackgroundPlanner = planner
        self._notifier: StatusNotifier = notifier
        self._current_model: Callable[[], RecognitionModel] = current_model
        self._restart_background: Callable[[], None] = restart_background

    def edit(self, frame_key: FrameKey, edit: Callable[[PicturePromptBoard], object]) -> None:
        """
        Change the drawings on a picture.

        Parameters
        ----------
        frame_key : FrameKey
            Picture the edit is drawn on.
        edit : Callable[[PicturePromptBoard], object]
            Edit applied to the drawings; an error it raises is passed on and nothing else happens.

        Raises
        ------
        KeyError
            If the picture's file is not open.
        """
        self._working.media_item(frame_key.path)
        self._workbench.picture_board.edit(frame_key.path, edit)
        self._changed(frame_key)

    def undo(self, path: Path) -> None:
        """
        Bring back the drawings of a media file as they were before its last edit, as ``edit`` would.

        Parameters
        ----------
        path : Path
            Open image or video.

        Raises
        ------
        KeyError
            If the file is not open.
        IndexError
            If the file has no edit to undo.
        """
        item: MediaItem = self._working.media_item(path)
        self._workbench.picture_board.undo(path)
        self._changed(self._shown_key_of(item))

    def redo(self, path: Path) -> None:
        """
        Apply the last undone drawing edit of a media file again, as ``edit`` would.

        Parameters
        ----------
        path : Path
            Open image or video.

        Raises
        ------
        KeyError
            If the file is not open.
        IndexError
            If the file has no undone edit.
        """
        item: MediaItem = self._working.media_item(path)
        self._workbench.picture_board.redo(path)
        self._changed(self._shown_key_of(item))

    def _shown_key_of(self, item: MediaItem) -> FrameKey:
        current: FrameKey | None = self._working.current_key
        return current if current is not None and current.path == item.path else item.key_at(None)

    def _changed(self, frame_key: FrameKey) -> None:
        self._notifier.save_reporting_failure(
            lambda: self._store.save(self._workbench.picture_prompts_by_task),
            "Could not remember the drawings",
        )
        model: RecognitionModel = self._current_model()
        is_drawing_read: bool = any(kind.is_drawn_on_picture for kind in model.supported_query_kinds)
        is_shown: bool = frame_key == self._working.current_key
        if self._settings.is_auto_inference and is_drawing_read and not model.is_sequential and is_shown:
            self._working.requested_key = frame_key
            self._planner.unpin()
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        self._restart_background()
