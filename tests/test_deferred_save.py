import time
from threading import Event, Thread
from typing import ClassVar

from manual_task_scheduler import ManualTaskScheduler

from ovir_gui.workspace import DeferredSave


class TestDeferredSave:
    """
    Changes are written once after the quiet time, off the owning thread, a change during a write is written right
    after it, a failed write is reported, and a write at quit waits for a running write without being overwritten by
    an older one.
    """

    WAIT_SECONDS: ClassVar[float] = 0.2

    def setup_method(self) -> None:
        self.scheduler: ManualTaskScheduler = ManualTaskScheduler()
        self.state: int = 0
        self.written: list[int] = []
        self.failures: list[str] = []
        self.is_failing: bool = False
        self.save: DeferredSave[int] = DeferredSave(
            self.scheduler, 2.0, lambda: self.state, self._write, lambda error: self.failures.append(str(error))
        )

    def _write(self, snapshot: int) -> None:
        if self.is_failing:
            raise OSError("disk full")
        self.written.append(snapshot)

    def test_changes_in_quick_succession_are_written_once(self) -> None:
        self.state = 1
        self.save.schedule()
        self.state = 2
        self.save.schedule()
        assert len(self.scheduler.delayed) == 1
        self.scheduler.run_delayed()
        assert self.written == []
        self.scheduler.run_blocking_work()
        assert self.written == [2]

    def test_change_during_a_write_is_written_after_it(self) -> None:
        self.state = 1
        self.save.save_soon()
        self.state = 2
        self.save.save_soon()
        assert len(self.scheduler.blocking) == 1
        self.scheduler.run_blocking_work()
        assert self.written == [1]
        self.scheduler.run_blocking_work()
        assert self.written == [1, 2]

    def test_save_now_writes_at_once_and_cancels_the_scheduled_write(self) -> None:
        self.state = 5
        self.save.schedule()
        self.save.save_now()
        assert self.written == [5]
        assert self.scheduler.delayed == []

    def test_failed_write_is_reported(self) -> None:
        self.is_failing = True
        self.save.save_soon()
        self.scheduler.run_blocking_work()
        assert self.failures == ["disk full"]
        self.is_failing = False
        self.state = 3
        self.save.save_soon()
        self.scheduler.run_blocking_work()
        assert self.written == [3]

    def test_save_now_waits_for_a_running_write(self) -> None:
        release: Event = Event()
        log: list[str] = []

        def slow_write(snapshot: int) -> None:
            log.append(f"start:{snapshot}")
            if snapshot == 1:
                _ = release.wait(5.0)
            log.append(f"end:{snapshot}")

        save: DeferredSave[int] = DeferredSave(self.scheduler, 2.0, lambda: self.state, slow_write, print)
        self.state = 1
        save.save_soon()
        background: Thread = Thread(target=self.scheduler.run_blocking_work)
        background.start()
        while not log:
            time.sleep(0.01)
        self.state = 2
        quitting: Thread = Thread(target=save.save_now)
        quitting.start()
        time.sleep(self.WAIT_SECONDS)
        assert log == ["start:1"]
        release.set()
        background.join()
        quitting.join()
        assert log == ["start:1", "end:1", "start:2", "end:2"]

    def test_older_background_write_does_not_replace_a_save_now(self) -> None:
        self.state = 1
        self.save.save_soon()
        self.state = 2
        self.save.save_now()
        self.scheduler.run_blocking_work()
        assert self.written == [2]
