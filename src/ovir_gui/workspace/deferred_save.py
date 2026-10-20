from collections.abc import Callable

from .scheduled_call import ScheduledCall
from .task_scheduler import TaskScheduler


class DeferredSave[SnapshotT]:
    """
    Writes one piece of workspace state shortly after it changes, off the owning thread.

    Changes in quick succession are written once, ``delay_seconds`` after the last one. The state is converted to a
    detached snapshot on the owning thread and written on another; a change arriving while a write runs is written
    right after it.
    """

    def __init__(
        self,
        scheduler: TaskScheduler,
        delay_seconds: float,
        snapshot: Callable[[], SnapshotT],
        write: Callable[[SnapshotT], None],
        on_failed: Callable[[Exception], None],
    ) -> None:
        """
        Parameters
        ----------
        scheduler : TaskScheduler
            Thread owning the state.
        delay_seconds : float
            Quiet time after the last change before writing.
        snapshot : Callable[[], SnapshotT]
            Converts the state for writing; called on the owning thread.
        write : Callable[[SnapshotT], None]
            Writes a snapshot; called on another thread.
        on_failed : Callable[[Exception], None]
            Reports a failed write; called on the owning thread.
        """
        self._scheduler: TaskScheduler = scheduler
        self._delay_seconds: float = delay_seconds
        self._snapshot: Callable[[], SnapshotT] = snapshot
        self._write: Callable[[SnapshotT], None] = write
        self._on_failed: Callable[[Exception], None] = on_failed
        self._call: ScheduledCall | None = None
        self._is_running: bool = False
        self._is_requested: bool = False

    def schedule(self) -> None:
        """
        Write after the quiet time, postponing a write scheduled before.
        """
        if self._call is not None:
            self._call.cancel()
        self._call = self._scheduler.call_later(self._delay_seconds, self.save_soon)

    def save_soon(self) -> None:
        """
        Write now off the owning thread, or right after the running write.
        """
        self._cancel_scheduled()
        if self._is_running:
            self._is_requested = True
            return
        snapshot: SnapshotT = self._snapshot()
        self._is_running = True
        self._scheduler.run_blocking(lambda: self._write(snapshot), self._on_written, self._on_write_failed)

    def save_now(self) -> None:
        """
        Write at once on the calling thread, e.g. when the application quits.

        Raises
        ------
        OSError
            If the state cannot be written.
        """
        self._cancel_scheduled()
        self._write(self._snapshot())

    def _cancel_scheduled(self) -> None:
        if self._call is not None:
            self._call.cancel()
            self._call = None

    def _on_written(self, _: None) -> None:
        self._is_running = False
        if self._is_requested:
            self._is_requested = False
            self.save_soon()

    def _on_write_failed(self, error: Exception) -> None:
        self._is_running = False
        self._on_failed(error)
