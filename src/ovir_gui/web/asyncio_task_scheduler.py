import asyncio
from collections.abc import Callable

from ..workspace import ScheduledCall


class AsyncioTaskScheduler:
    """
    ``TaskScheduler`` running the workspace on the event loop of the web server.

    The event loop plays the role of the GUI thread: request handlers and every callback run on it, and blocking work
    runs in the default executor. ``settle`` waits for the blocking work in flight and the callbacks handed over by
    other threads, so the server can save the final state when it stops.
    """

    def __init__(self, loop: asyncio.AbstractEventLoop) -> None:
        """
        Parameters
        ----------
        loop : asyncio.AbstractEventLoop
            Running event loop of the server.
        """
        self._loop: asyncio.AbstractEventLoop = loop
        self._in_flight: set[asyncio.Future[None]] = set()

    def dispatch(self, callback: Callable[[], None]) -> None:
        """
        Run a callback on the event loop soon; safe to call from any thread.

        Parameters
        ----------
        callback : Callable[[], None]
            Work to run.
        """
        self._loop.call_soon_threadsafe(callback)

    def call_later(self, delay_seconds: float, callback: Callable[[], None]) -> ScheduledCall:
        """
        Run a callback on the event loop after a delay.

        Parameters
        ----------
        delay_seconds : float
            Delay before the callback runs.
        callback : Callable[[], None]
            Work to run.

        Returns
        -------
        ScheduledCall
            Handle cancelling the callback.
        """
        return self._loop.call_later(delay_seconds, callback)

    def run_blocking[ResultT](
        self,
        task: Callable[[], ResultT],
        on_done: Callable[[ResultT], None],
        on_error: Callable[[Exception], None],
    ) -> None:
        """
        Run blocking work in the default executor and report its outcome on the event loop.

        Parameters
        ----------
        task : Callable[[], ResultT]
            Work to run on another thread.
        on_done : Callable[[ResultT], None]
            Called on the event loop with the result of ``task``.
        on_error : Callable[[Exception], None]
            Called on the event loop with the error ``task`` raised.
        """
        future: asyncio.Future[ResultT] = self._loop.run_in_executor(None, task)
        reported: asyncio.Future[None] = self._loop.create_future()
        self._in_flight.add(reported)
        reported.add_done_callback(self._in_flight.discard)

        def report(finished: asyncio.Future[ResultT]) -> None:
            try:
                error: BaseException | None = finished.exception()
                match error:
                    case None:
                        on_done(finished.result())
                    case Exception():
                        on_error(error)
                    case _:
                        raise error
            finally:
                reported.set_result(None)

        future.add_done_callback(report)

    async def settle(self, timeout_seconds: float) -> None:
        """
        Wait until the callbacks dispatched so far have run and the blocking work in flight has reported its outcome.

        Blocking work started while reporting is waited for as well.

        Parameters
        ----------
        timeout_seconds : float
            Longest wait for the blocking work; work still running afterwards is left to finish on its own.
        """
        deadline: float = self._loop.time() + timeout_seconds
        await self._run_dispatched()
        while self._in_flight:
            remaining_seconds: float = deadline - self._loop.time()
            if remaining_seconds <= 0:
                return
            _ = await asyncio.wait(set(self._in_flight), timeout=remaining_seconds)
            await self._run_dispatched()

    async def _run_dispatched(self) -> None:
        marker: asyncio.Future[None] = self._loop.create_future()
        self._loop.call_soon(marker.set_result, None)
        await marker
