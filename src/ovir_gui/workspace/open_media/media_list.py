from collections.abc import Callable, Iterable, Sequence
from pathlib import Path

from ...media import FrameKey, MediaCollection, MediaItem
from ...results import RecognitionTask
from ...storage import SessionMedia
from ...wording import CountedNoun
from ..messages.status_notifier import StatusNotifier
from ..messages.topic import WorkspaceTopic
from ..recognition.settings import RecognitionSettings
from ..scheduling.task_scheduler import TaskScheduler
from ..session_mapper import SessionMapper
from ..working_state import WorkingState
from .addition import OpenedMedia


class MediaList:
    """
    Opens and closes the images and videos of the current task.

    Files are found and read off the owning thread, so a large or slow folder never holds up the other requests; they
    are added on the owning thread afterwards, unless the task changed meanwhile.
    """

    def __init__(
        self,
        scheduler: TaskScheduler,
        working: WorkingState,
        settings: RecognitionSettings,
        session: SessionMapper,
        notifier: StatusNotifier,
        show: Callable[[Path, int | None], None],
        resume_background: Callable[[], None],
        media_closed: Callable[[], None],
    ) -> None:
        """
        Parameters
        ----------
        scheduler : TaskScheduler
            Thread owning the workspace, which also reads the files off it.
        working : WorkingState
            Open media and shown picture.
        settings : RecognitionSettings
            Current task.
        session : SessionMapper
            Remembered media of each task, saved after every change.
        notifier : StatusNotifier
            Views told about added and closed files.
        show : Callable[[Path, int | None], None]
            Shows an open file at a frame, as ``Workspace.show`` does.
        resume_background : Callable[[], None]
            Lets background recognition continue with the added files.
        media_closed : Callable[[], None]
            Saves the session, tells the views the state and results changed and restarts background recognition.
        """
        self._scheduler: TaskScheduler = scheduler
        self._working: WorkingState = working
        self._settings: RecognitionSettings = settings
        self._session: SessionMapper = session
        self._notifier: StatusNotifier = notifier
        self._show: Callable[[Path, int | None], None] = show
        self._resume_background: Callable[[], None] = resume_background
        self._media_closed: Callable[[], None] = media_closed
        self._opening_count: int = 0
        self._opening_waiters: list[Callable[[], None]] = []

    def open_paths(self, paths: Iterable[Path], is_first_shown: bool = True) -> None:
        """
        Add image and video files, or every one inside directories, to the open media.

        ``when_opened`` tells when they are added.

        Parameters
        ----------
        paths : Iterable[Path]
            Files and directories.
        is_first_shown : bool, optional
            Whether the first added file is shown; otherwise only when nothing was shown.
        """
        self._open_in_background(tuple(paths), lambda opened: self._add_opened(opened, is_first_shown))

    def when_opened(self, callback: Callable[[], None]) -> None:
        """
        Run a callback on the owning thread once every file being opened has been added; at once when none is.

        Parameters
        ----------
        callback : Callable[[], None]
            Work to run.
        """
        if self._opening_count == 0:
            callback()
            return
        self._opening_waiters.append(callback)

    def restore_session(self) -> None:
        """
        Open the media the current task had open in the last session again and show the picture shown then; missing
        files are skipped. Does nothing once the task's remembered media were opened.
        """
        remembered: SessionMedia | None = self._session.take_unopened_media(self._settings.task)
        if remembered is None:
            return
        self._open_in_background(remembered.paths, lambda opened: self._add_remembered(remembered, opened))

    def close(self, paths: Iterable[Path]) -> None:
        """
        Close files, keeping their stored results; when the shown file is closed, the next remaining one is shown.

        Parameters
        ----------
        paths : Iterable[Path]
            Open files to close; others are ignored.
        """
        closed: frozenset[Path] = frozenset(paths) & frozenset(self._working.media)
        if not closed:
            return
        current: FrameKey | None = self._working.current_key
        if current is not None and current.path in closed:
            following: Path | None = self._working.next_remaining_path(closed)
            self._working.show_key(None if following is None else self._working.media[following].key_at(0))
        for path in closed:
            del self._working.media[path]
        self._notifier.inform(f"Closed {CountedNoun('file').of(len(closed))}.")
        self._media_closed()

    def _add_remembered(self, remembered: SessionMedia, opened: OpenedMedia) -> None:
        existing_count: int = len(remembered.paths) - opened.missing_count
        if existing_count == 0:
            self._notifier.inform(f"None of the {opened.missing_count} files of the last session exist any more.")
            return
        self._add_opened(opened, True)
        if remembered.current_path is not None and remembered.current_path in self._working.media:
            self._show(remembered.current_path, remembered.current_frame_index)
        missing_note: str = f" ({opened.missing_count} missing skipped)" if opened.missing_count else ""
        self._notifier.inform(f"Restored {CountedNoun('file').of(existing_count)} of the last session{missing_note}.")

    def _open_in_background(self, paths: Sequence[Path], add: Callable[[OpenedMedia], None]) -> None:
        task: RecognitionTask = self._settings.task
        known_paths: frozenset[Path] = frozenset(self._working.media)
        self._opening_count += 1
        self._scheduler.run_blocking(
            lambda: OpenedMedia.read(paths, known_paths),
            lambda opened: self._finish_opening(lambda: self._add_if_task_kept(task, opened, add)),
            lambda error: self._finish_opening(lambda: self._notifier.inform(f"Could not open the files: {error}")),
        )

    def _add_if_task_kept(self, task: RecognitionTask, opened: OpenedMedia, add: Callable[[OpenedMedia], None]) -> None:
        if task is not self._settings.task:
            self._notifier.inform(f"Files opened for {task.value} were not added, as the task changed meanwhile.")
            return
        add(opened)

    def _finish_opening(self, apply: Callable[[], None]) -> None:
        try:
            apply()
        finally:
            self._opening_count -= 1
            if self._opening_count == 0:
                waiters: list[Callable[[], None]] = self._opening_waiters
                self._opening_waiters = []
                for waiter in waiters:
                    waiter()

    def _add_opened(self, opened: OpenedMedia, is_first_shown: bool) -> None:
        collection: MediaCollection = opened.collection
        missing_note: str = f" ({opened.missing_count} not found)" if opened.missing_count else ""
        added: list[MediaItem] = [item for item in opened.items if item.path not in self._working.media]
        if not added and not opened.unreadable:
            self._notifier.inform(collection.describe(f"No new images or videos found{missing_note}"))
            return
        for item in added:
            self._working.media[item.path] = item
        if added and (is_first_shown or self._working.current_key is None):
            self._working.show_key(added[0].key_at(0))
        self._notifier.inform(collection.describe(f"{self._headline(added, opened.unreadable)}{missing_note}"))
        self._session.save()
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        self._resume_background()

    @staticmethod
    def _headline(added: Sequence[MediaItem], unreadable: Sequence[str]) -> str:
        video_count: int = sum(1 for item in added if item.is_video)
        image_count: int = len(added) - video_count
        parts: list[str] = []
        if image_count:
            parts.append(CountedNoun("image").of(image_count))
        if video_count:
            parts.append(CountedNoun("video").of(video_count))
        headline: str = f"Added {' and '.join(parts)}" if parts else "Added nothing"
        if unreadable:
            headline = f"{headline}; could not open {', '.join(unreadable)}"
        return headline
