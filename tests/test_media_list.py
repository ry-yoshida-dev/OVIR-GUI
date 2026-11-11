from pathlib import Path

import cv2
import numpy as np
import pytest
from manual_task_scheduler import ManualTaskScheduler

from ovir_gui.inference import DeviceAvailability, LicenseConsent, ModelSelector, PresetCatalog
from ovir_gui.results import RecognitionTask
from ovir_gui.workspace import (
    MediaList,
    RecognitionSettings,
    SessionMapper,
    StatusNotifier,
    WorkingState,
    WorkspaceStores,
)


class TestMediaList:
    """
    Files are added only after they are read off the owning thread, waiters run once every opening finished, files
    opened for a task that is no longer shown are dropped, and closing the shown file shows the next remaining one.
    """

    @pytest.fixture(autouse=True)
    def media_list(self, tmp_path: Path) -> MediaList:
        self.media_directory: Path = tmp_path / "media"
        self.media_directory.mkdir()
        for name in ("a.png", "b.png", "c.png"):
            _ = cv2.imwrite(str(self.media_directory / name), np.zeros((8, 8, 3), dtype=np.uint8))
        self.scheduler: ManualTaskScheduler = ManualTaskScheduler()
        self.working: WorkingState = WorkingState()
        self.settings: RecognitionSettings = RecognitionSettings(RecognitionTask.DETECTION)
        self.notifier: StatusNotifier = StatusNotifier()
        self.shown: list[tuple[Path, int | None]] = []
        self.resume_count: int = 0
        self.closed_count: int = 0
        session: SessionMapper = SessionMapper(
            ModelSelector(PresetCatalog.from_packages(), DeviceAvailability.detect()),
            LicenseConsent(),
            WorkspaceStores.in_directory(tmp_path / "data").session_store,
            self.notifier,
            self.working,
            self.settings,
        )
        self.media_list: MediaList = MediaList(
            self.scheduler,
            self.working,
            self.settings,
            session,
            self.notifier,
            lambda path, frame_index: self.shown.append((path, frame_index)),
            self._resume,
            self._close,
        )
        return self.media_list

    def _resume(self) -> None:
        self.resume_count += 1

    def _close(self) -> None:
        self.closed_count += 1

    def _open_all(self) -> None:
        self.media_list.open_paths([self.media_directory])
        self.scheduler.run_blocking_work()

    def test_files_are_added_after_they_are_read(self) -> None:
        self.media_list.open_paths([self.media_directory])
        assert self.working.media == {}
        self.scheduler.run_blocking_work()
        assert [path.name for path in self.working.media] == ["a.png", "b.png", "c.png"]
        assert self.working.current_key is not None
        assert self.working.current_key.path.name == "a.png"
        assert self.resume_count == 1
        assert self.notifier.status_message.startswith("Added 3 images")

    def test_waiter_runs_at_once_when_nothing_is_opening(self) -> None:
        calls: list[str] = []
        self.media_list.when_opened(lambda: calls.append("done"))
        assert calls == ["done"]

    def test_waiter_runs_once_every_opening_finished(self) -> None:
        calls: list[str] = []
        self.media_list.open_paths([self.media_directory / "a.png"])
        self.media_list.open_paths([self.media_directory / "b.png"])
        self.media_list.when_opened(lambda: calls.append("done"))
        assert calls == []
        self.scheduler.run_blocking_work()
        assert calls == ["done"]
        assert len(self.working.media) == 2

    def test_files_opened_for_a_task_no_longer_shown_are_dropped(self) -> None:
        calls: list[str] = []
        self.media_list.open_paths([self.media_directory])
        self.media_list.when_opened(lambda: calls.append("done"))
        self.settings.task = RecognitionTask.CLASSIFICATION
        self.scheduler.run_blocking_work()
        assert self.working.media == {}
        assert calls == ["done"]
        assert "task changed" in self.notifier.status_message

    def test_already_open_files_are_not_added_again(self) -> None:
        self._open_all()
        self._open_all()
        assert len(self.working.media) == 3
        assert self.notifier.status_message.startswith("No new images or videos found")

    def test_closing_the_shown_file_shows_the_next_remaining_one(self) -> None:
        self._open_all()
        paths: list[Path] = list(self.working.media)
        self.media_list.close(paths[:2])
        assert list(self.working.media) == paths[2:]
        assert self.working.current_key is not None
        assert self.working.current_key.path == paths[2]
        assert self.closed_count == 1

    def test_closing_files_that_are_not_open_does_nothing(self) -> None:
        self._open_all()
        self.media_list.close([self.media_directory / "missing.png"])
        assert len(self.working.media) == 3
        assert self.closed_count == 0
