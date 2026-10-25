from pathlib import Path

from ..media import FrameKey, MediaItem
from ..models import ModelProfile
from ..recognition import RecognitionTask
from .run_progress import RunProgress
from .task_media import TaskMedia


class WorkingState:
    """
    What the user works on right now, shared by the parts of the workspace: the open media and shown picture of the
    current task, the media and compared profiles left in the other tasks, the shown and compared result profiles, and
    the latest run of the shown picture.

    The state is owned by the thread of the workspace and changed only by its parts; it holds no rules of its own.
    """

    def __init__(self) -> None:
        self.media: dict[Path, MediaItem] = {}
        self.current_key: FrameKey | None = None
        self.is_playing: bool = False
        self.shown_profile: ModelProfile | None = None
        self.compared_profile: ModelProfile | None = None
        self.requested_key: FrameKey | None = None
        self.summary: str = ""
        self.progress: RunProgress | None = None
        self.parked_media: dict[RecognitionTask, TaskMedia] = {}
        self.parked_compared_profiles: dict[RecognitionTask, ModelProfile] = {}

    @property
    def current_item(self) -> MediaItem | None:
        """
        Shown file.

        Returns
        -------
        MediaItem | None
            ``None`` while nothing is open.
        """
        return None if self.current_key is None else self.media.get(self.current_key.path)

    def media_item(self, path: Path) -> MediaItem:
        """
        One open file.

        Parameters
        ----------
        path : Path
            Open image or video.

        Returns
        -------
        MediaItem
            The item.

        Raises
        ------
        KeyError
            If the file is not open.
        """
        if path not in self.media:
            raise KeyError(f"{path} is not open")
        return self.media[path]

    def show_key(self, frame_key: FrameKey | None) -> None:
        """
        Show another picture from a stop, forgetting the summary of the previous one.

        Parameters
        ----------
        frame_key : FrameKey | None
            Picture to show; ``None`` shows nothing.
        """
        self.current_key = frame_key
        self.is_playing = False
        self.summary = ""

    def switch_media(self, leaving: RecognitionTask, entering: RecognitionTask) -> bool:
        """
        Keep the open media of the task left and open those of the task entered.

        Parameters
        ----------
        leaving : RecognitionTask
            Task whose media and shown picture are kept aside.
        entering : RecognitionTask
            Task whose kept media and shown picture are opened again.

        Returns
        -------
        bool
            Whether the task entered had media kept; otherwise nothing is open afterwards.
        """
        self.parked_media[leaving] = TaskMedia(self.media, self.current_key)
        entered: TaskMedia | None = self.parked_media.pop(entering, None)
        self.media = {} if entered is None else entered.media
        self.show_key(None if entered is None else entered.current_key)
        self.requested_key = None
        return entered is not None

    def switch_comparison(self, leaving: RecognitionTask, entering: RecognitionTask) -> ModelProfile | None:
        """
        Keep the compared profile of the task left aside and stop comparing.

        Parameters
        ----------
        leaving : RecognitionTask
            Task whose compared profile is kept aside.
        entering : RecognitionTask
            Task whose kept compared profile is handed back.

        Returns
        -------
        ModelProfile | None
            Profile the task entered compared with when it was left; ``None`` when it compared with none.
        """
        if self.compared_profile is None:
            self.parked_compared_profiles.pop(leaving, None)
        else:
            self.parked_compared_profiles[leaving] = self.compared_profile
        self.compared_profile = None
        return self.parked_compared_profiles.pop(entering, None)

    def next_remaining_path(self, closed: frozenset[Path]) -> Path | None:
        """
        File shown after the shown one is closed with others.

        Parameters
        ----------
        closed : frozenset[Path]
            Open files about to be closed.

        Returns
        -------
        Path | None
            The next remaining file in list order, else the previous one; ``None`` when none remains or nothing is
            shown.
        """
        if self.current_key is None:
            return None
        paths: list[Path] = list(self.media)
        index: int = paths.index(self.current_key.path)
        following: list[Path] = [path for path in paths[index:] if path not in closed]
        preceding: list[Path] = [path for path in paths[:index] if path not in closed]
        if following:
            return following[0]
        return preceding[-1] if preceding else None

    def ordered_from_shown(self, frame_keys: tuple[FrameKey, ...], start_frame: int | None) -> tuple[FrameKey, ...]:
        """
        Pictures ordered for a run: the shown media first from a start frame on, then its earlier frames, then the
        other media in list order after it.

        Parameters
        ----------
        frame_keys : tuple[FrameKey, ...]
            Pictures of open files.
        start_frame : int | None
            Frame of the shown video recognized first; the shown frame when ``None``.

        Returns
        -------
        tuple[FrameKey, ...]
            The same pictures reordered; unchanged while nothing is shown.
        """
        current: FrameKey | None = self.current_key
        if current is None:
            return frame_keys
        paths: list[Path] = list(self.media)
        shown_index: int = paths.index(current.path)
        rank_of: dict[Path, int] = {path: (index - shown_index) % len(paths) for index, path in enumerate(paths)}
        first_frame: int = start_frame if start_frame is not None else (current.frame_index or 0)
        return tuple(
            sorted(
                frame_keys,
                key=lambda key: (
                    rank_of[key.path],
                    key.path == current.path and (key.frame_index or 0) < first_frame,
                ),
            )
        )
