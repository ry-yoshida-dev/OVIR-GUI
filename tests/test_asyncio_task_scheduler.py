import asyncio
import time
from typing import ClassVar

from ovir_gui.web.asyncio_task_scheduler import AsyncioTaskScheduler


class TestAsyncioTaskScheduler:
    """
    Settling waits for dispatched callbacks and for blocking work, including work started while reporting.
    """

    WORK_SECONDS: ClassVar[float] = 0.2

    def test_settle_waits_for_blocking_work_and_its_follow_up(self) -> None:
        reported: list[str] = []

        async def scenario() -> None:
            scheduler: AsyncioTaskScheduler = AsyncioTaskScheduler(asyncio.get_running_loop())

            def follow_up(result: str) -> None:
                reported.append(result)
                if result == "first":
                    scheduler.run_blocking(lambda: self._slow("second"), reported.append, print)

            scheduler.run_blocking(lambda: self._slow("first"), follow_up, print)
            scheduler.dispatch(lambda: reported.append("dispatched"))
            await scheduler.settle(5.0)

        asyncio.run(scenario())
        assert reported == ["dispatched", "first", "second"]

    def test_settle_gives_up_after_the_timeout(self) -> None:
        reported: list[str] = []

        async def scenario() -> None:
            scheduler: AsyncioTaskScheduler = AsyncioTaskScheduler(asyncio.get_running_loop())
            scheduler.run_blocking(lambda: self._slow("late"), reported.append, print)
            await scheduler.settle(0.01)
            assert reported == []
            await scheduler.settle(5.0)

        asyncio.run(scenario())
        assert reported == ["late"]

    def _slow(self, result: str) -> str:
        time.sleep(self.WORK_SECONDS)
        return result
