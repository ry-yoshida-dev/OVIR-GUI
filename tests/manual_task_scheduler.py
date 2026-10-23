from collections.abc import Callable
from dataclasses import dataclass, field

from manual_scheduled_call import ManualScheduledCall


@dataclass
class ManualTaskScheduler:
    """
    Task scheduler run by hand: delayed calls and blocking work wait until the test runs them.

    Attributes
    ----------
    delayed : list[Callable[[], None]]
        Delayed callbacks not cancelled, in scheduling order.
    blocking : list[Callable[[], None]]
        Blocking work with its reporting, in submission order.
    """

    delayed: list[Callable[[], None]] = field(default_factory=list[Callable[[], None]])
    blocking: list[Callable[[], None]] = field(default_factory=list[Callable[[], None]])

    def dispatch(self, callback: Callable[[], None]) -> None:
        """
        Run a callback at once.

        Parameters
        ----------
        callback : Callable[[], None]
            Work to run.
        """
        callback()

    def call_later(self, delay_seconds: float, callback: Callable[[], None]) -> ManualScheduledCall:
        """
        Keep a callback until ``run_delayed``.

        Parameters
        ----------
        delay_seconds : float
            Ignored.
        callback : Callable[[], None]
            Work to run.

        Returns
        -------
        ManualScheduledCall
            Handle removing the callback.
        """
        self.delayed.append(callback)
        return ManualScheduledCall(self.delayed, callback)

    def run_blocking[ResultT](
        self,
        task: Callable[[], ResultT],
        on_done: Callable[[ResultT], None],
        on_error: Callable[[Exception], None],
    ) -> None:
        """
        Keep blocking work until ``run_blocking_work``.

        Parameters
        ----------
        task : Callable[[], ResultT]
            Work to run.
        on_done : Callable[[ResultT], None]
            Called with the result.
        on_error : Callable[[Exception], None]
            Called with the error.
        """

        def run() -> None:
            try:
                result: ResultT = task()
            except Exception as error:  # noqa: BLE001
                on_error(error)
                return
            on_done(result)

        self.blocking.append(run)

    def run_delayed(self) -> None:
        """
        Run every delayed callback kept so far.
        """
        callbacks: list[Callable[[], None]] = list(self.delayed)
        self.delayed.clear()
        for callback in callbacks:
            callback()

    def run_blocking_work(self) -> None:
        """
        Run every blocking work kept so far.
        """
        works: list[Callable[[], None]] = list(self.blocking)
        self.blocking.clear()
        for work in works:
            work()
