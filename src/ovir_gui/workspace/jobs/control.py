from threading import Event


class JobControl:
    """
    Shared between the owning thread and the worker: whether a job should stop, and how far it has come.

    The worker checks ``is_stop_requested`` between pictures and mini-batches. A stop is either a cancel, which the
    user asked for, or an interrupt, which lets a background job yield to other work.
    """

    def __init__(self) -> None:
        self._stop_event: Event = Event()
        self._is_cancelled: bool = False
        self._processed_count: int = 0

    @property
    def is_stop_requested(self) -> bool:
        """
        Whether the job should stop after the current mini-batch.

        Returns
        -------
        bool
            True after ``cancel`` or ``interrupt``.
        """
        return self._stop_event.is_set()

    @property
    def is_cancelled(self) -> bool:
        """
        Whether the user cancelled the job.

        Returns
        -------
        bool
            True after ``cancel``.
        """
        return self._is_cancelled

    @property
    def processed_count(self) -> int:
        """
        Pictures the worker has handed back so far.

        Returns
        -------
        int
            Recognized and unreadable pictures.
        """
        return self._processed_count

    def cancel(self) -> None:
        """
        Stop the job at the user's request.
        """
        self._is_cancelled = True
        self._stop_event.set()

    def interrupt(self) -> None:
        """
        Stop the job so that other work can run.
        """
        self._stop_event.set()

    def advance(self, count: int) -> None:
        """
        Count pictures handed back; called by the worker.

        Parameters
        ----------
        count : int
            Pictures handed back since the last call.
        """
        self._processed_count += count
