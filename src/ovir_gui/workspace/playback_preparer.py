from pathlib import Path

from ..media import MediaItem, PlaybackProxyWriter
from ..storage import PlaybackStore
from .playback_state import PlaybackState
from .status_notifier import StatusNotifier
from .task_scheduler import TaskScheduler
from .working_state import WorkingState


class PlaybackPreparer:
    """
    Encodes browser-playable copies of open videos the browser cannot decode, off the owning thread, and tells which
    file to play.

    A copy is made once per video and cached in the data directory; a failed encoding is reported and can be retried.
    """

    def __init__(
        self, scheduler: TaskScheduler, store: PlaybackStore, working: WorkingState, notifier: StatusNotifier
    ) -> None:
        """
        Parameters
        ----------
        scheduler : TaskScheduler
            Thread owning the workspace, running the encoding elsewhere.
        store : PlaybackStore
            Folder caching the playable copies.
        working : WorkingState
            Open media.
        notifier : StatusNotifier
            Views told about the progress.
        """
        self._scheduler: TaskScheduler = scheduler
        self._store: PlaybackStore = store
        self._working: WorkingState = working
        self._notifier: StatusNotifier = notifier
        self._writer: PlaybackProxyWriter = PlaybackProxyWriter()
        self._preparing_paths: set[Path] = set()
        self._failed_paths: set[Path] = set()

    def state_of(self, path: Path) -> PlaybackState:
        """
        Whether an open video has a browser-playable copy.

        Parameters
        ----------
        path : Path
            Open video.

        Returns
        -------
        PlaybackState
            State of its copy; ``NONE`` for an image.
        """
        if path in self._preparing_paths:
            return PlaybackState.PREPARING
        if path in self._failed_paths:
            return PlaybackState.FAILED
        if self._store.existing(path) is not None:
            return PlaybackState.READY
        return PlaybackState.NONE

    def path_of(self, path: Path) -> Path:
        """
        File the browser plays for an open video: its playable copy when one exists, else the file itself.

        Parameters
        ----------
        path : Path
            Open video.

        Returns
        -------
        Path
            File to serve.

        Raises
        ------
        KeyError
            If the file is not open.
        ValueError
            If the file is not a video.
        """
        item: MediaItem = self._working.media_item(path)
        item.require_video()
        return self._store.existing(item.path) or item.path

    def prepare(self, path: Path) -> None:
        """
        Encode a browser-playable copy of an open video off the owning thread, unless one exists or is being made.

        Parameters
        ----------
        path : Path
            Open video the browser cannot decode.

        Raises
        ------
        KeyError
            If the file is not open.
        ValueError
            If the file is not a video.
        """
        item: MediaItem = self._working.media_item(path)
        item.require_video()
        match self.state_of(path):
            case PlaybackState.PREPARING | PlaybackState.READY:
                return
            case PlaybackState.NONE | PlaybackState.FAILED:
                pass
        self._failed_paths.discard(path)
        self._preparing_paths.add(path)
        self._notifier.inform(f"The browser cannot play {path.name}; preparing a playable copy ...")
        self._scheduler.run_blocking(
            lambda: self._writer.write(item, self._store.path_of(item.path)),
            lambda _: self._on_prepared(path),
            lambda error: self._on_failed(path, error),
        )

    def _on_prepared(self, path: Path) -> None:
        self._preparing_paths.discard(path)
        self._notifier.inform(f"Prepared a playable copy of {path.name}.")

    def _on_failed(self, path: Path, error: Exception) -> None:
        self._preparing_paths.discard(path)
        self._failed_paths.add(path)
        self._notifier.alert(f"Could not prepare a playable copy of {path.name}", str(error))
