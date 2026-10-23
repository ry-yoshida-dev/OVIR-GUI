from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class ManualScheduledCall:
    """
    Handle of a delayed callback kept by a ``ManualTaskScheduler``.

    Attributes
    ----------
    delayed : list[Callable[[], None]]
        Callbacks of the scheduler waiting to run.
    callback : Callable[[], None]
        Kept callback.
    """

    delayed: list[Callable[[], None]]
    callback: Callable[[], None]

    def cancel(self) -> None:
        """
        Remove the callback if it has not run.
        """
        if self.callback in self.delayed:
            self.delayed.remove(self.callback)
