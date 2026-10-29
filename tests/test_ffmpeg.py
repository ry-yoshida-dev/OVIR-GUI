import hashlib
import io
import os
import subprocess
import sys
import zipfile
from collections.abc import Callable
from pathlib import Path

import pytest

from ovir_gui.ffmpeg import FFmpegDownloader, FFmpegInstallation, FFmpegProbe, FFmpegStartupCheck, OperatingSystem

BUILD_NAME = "ffmpeg-9.0.2-full_build-shared"


class FixedProbe(FFmpegProbe):
    """
    Probe answering in turn from a list of availabilities.
    """

    def __init__(self, availabilities: list[bool]) -> None:
        self.availabilities: list[bool] = availabilities
        self.call_count: int = 0

    def is_available(self) -> bool:
        self.call_count += 1
        return self.availabilities.pop(0)


class RecordingDownloader(FFmpegDownloader):
    """
    Downloader installing an empty executable instead of fetching a build.
    """

    def __init__(self) -> None:
        super().__init__()
        self.call_count: int = 0

    def download(self, installation: FFmpegInstallation, on_progress: Callable[[int, int], None]) -> None:
        self.call_count += 1
        staging: Path = installation.directory.parent / "staging-bin"
        staging.mkdir(parents=True)
        (staging / FFmpegInstallation.EXECUTABLE_NAME).touch()
        on_progress(1, 1)
        installation.install(staging, None)


def archive_of(members: dict[str, bytes]) -> bytes:
    buffer: io.BytesIO = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as bundle:
        for name, content in members.items():
            bundle.writestr(name, content)
    return buffer.getvalue()


@pytest.fixture
def installation(tmp_path: Path) -> FFmpegInstallation:
    return FFmpegInstallation(tmp_path / "ffmpeg")


@pytest.fixture(autouse=True)
def restore_search_path(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PATH", os.environ.get("PATH", ""))


class TestFFmpegStartupCheck:
    """
    A downloaded build is used without probing, a missing FFmpeg is offered for download only on Windows in a
    terminal, and a declined download is not offered again until requested.
    """

    def check(
        self,
        installation: FFmpegInstallation,
        probe: FixedProbe,
        downloader: RecordingDownloader,
        operating_system: OperatingSystem = OperatingSystem.WINDOWS,
        is_interactive: bool = True,
    ) -> FFmpegStartupCheck:
        return FFmpegStartupCheck(installation, downloader, probe, operating_system, is_interactive)

    def test_downloaded_build_is_put_first_on_the_search_path(self, installation: FFmpegInstallation) -> None:
        installation.bin_directory.mkdir(parents=True)
        (installation.bin_directory / FFmpegInstallation.EXECUTABLE_NAME).touch()
        probe: FixedProbe = FixedProbe([])
        self.check(installation, probe, RecordingDownloader()).run(False)
        assert os.environ["PATH"].split(os.pathsep)[0] == str(installation.bin_directory)
        assert probe.call_count == 0

    def test_ffmpeg_of_the_computer_needs_no_question(
        self, installation: FFmpegInstallation, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr("builtins.input", self.refuse_question)
        downloader: RecordingDownloader = RecordingDownloader()
        self.check(installation, FixedProbe([True]), downloader).run(False)
        assert downloader.call_count == 0

    def test_accepted_download_is_installed_and_verified(
        self, installation: FFmpegInstallation, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        monkeypatch.setattr("builtins.input", self.accept_question)
        downloader: RecordingDownloader = RecordingDownloader()
        self.check(installation, FixedProbe([False, True]), downloader).run(False)
        assert downloader.call_count == 1
        assert installation.is_installed
        assert "FFmpeg is ready." in capsys.readouterr().out

    def test_declined_download_is_not_offered_again(
        self, installation: FFmpegInstallation, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        monkeypatch.setattr("builtins.input", self.decline_question)
        downloader: RecordingDownloader = RecordingDownloader()
        self.check(installation, FixedProbe([False]), downloader).run(False)
        assert installation.is_declined
        monkeypatch.setattr("builtins.input", self.refuse_question)
        self.check(installation, FixedProbe([False]), downloader).run(False)
        assert downloader.call_count == 0
        assert "--download-ffmpeg" in capsys.readouterr().out

    def test_requested_download_follows_a_decline(self, installation: FFmpegInstallation) -> None:
        installation.remember_declined()
        downloader: RecordingDownloader = RecordingDownloader()
        self.check(installation, FixedProbe([True]), downloader).run(True)
        assert downloader.call_count == 1
        assert not installation.is_declined

    @pytest.mark.parametrize(
        ("operating_system", "is_interactive"),
        [(OperatingSystem.WINDOWS, False), (OperatingSystem.MACOS, True), (OperatingSystem.LINUX, True)],
    )
    def test_nothing_is_asked_without_terminal_or_outside_windows(
        self,
        installation: FFmpegInstallation,
        monkeypatch: pytest.MonkeyPatch,
        capsys: pytest.CaptureFixture[str],
        operating_system: OperatingSystem,
        is_interactive: bool,
    ) -> None:
        monkeypatch.setattr("builtins.input", self.refuse_question)
        downloader: RecordingDownloader = RecordingDownloader()
        self.check(installation, FixedProbe([False]), downloader, operating_system, is_interactive).run(False)
        assert downloader.call_count == 0
        assert not installation.is_declined
        assert operating_system.ffmpeg_install_hint in capsys.readouterr().out

    @staticmethod
    def accept_question(prompt: str) -> str:
        return ""

    @staticmethod
    def decline_question(prompt: str) -> str:
        return "n"

    @staticmethod
    def refuse_question(prompt: str) -> str:
        raise AssertionError(f"Unexpected question: {prompt}")


class TestFFmpegDownloader:
    """
    The archive is checked against its SHA-256, and only its ``bin`` folder and license are installed.
    """

    def serve(self, tmp_path: Path, content: bytes) -> str:
        archive: Path = tmp_path / "served.zip"
        archive.write_bytes(content)
        return archive.as_uri()

    def test_bin_folder_and_license_are_installed(self, tmp_path: Path, installation: FFmpegInstallation) -> None:
        content: bytes = archive_of(
            {
                f"{BUILD_NAME}/bin/{FFmpegInstallation.EXECUTABLE_NAME}": b"exe",
                f"{BUILD_NAME}/bin/avcodec-62.dll": b"dll",
                f"{BUILD_NAME}/LICENSE": b"GPL",
                f"{BUILD_NAME}/include/libavcodec/avcodec.h": b"header",
            }
        )
        progress: list[int] = []
        downloader: FFmpegDownloader = FFmpegDownloader(
            self.serve(tmp_path, content), hashlib.sha256(content).hexdigest()
        )
        downloader.download(installation, lambda received, _: progress.append(received))
        assert sorted(path.name for path in installation.bin_directory.iterdir()) == [
            "avcodec-62.dll",
            FFmpegInstallation.EXECUTABLE_NAME,
        ]
        assert (installation.directory / "LICENSE").read_bytes() == b"GPL"
        assert progress[-1] == len(content)
        assert sorted(path.name for path in installation.directory.iterdir()) == ["LICENSE", "bin"]

    def test_mismatching_archive_is_refused(self, tmp_path: Path, installation: FFmpegInstallation) -> None:
        content: bytes = archive_of({f"{BUILD_NAME}/bin/{FFmpegInstallation.EXECUTABLE_NAME}": b"exe"})
        downloader: FFmpegDownloader = FFmpegDownloader(self.serve(tmp_path, content), "0" * 64)
        with pytest.raises(ValueError, match="SHA-256"):
            downloader.download(installation, lambda received, total: None)
        assert not installation.is_installed
        assert list(installation.directory.iterdir()) == []

    def test_archive_without_executable_is_refused(self, tmp_path: Path, installation: FFmpegInstallation) -> None:
        content: bytes = archive_of({f"{BUILD_NAME}/bin/avcodec-62.dll": b"dll"})
        downloader: FFmpegDownloader = FFmpegDownloader(
            self.serve(tmp_path, content), hashlib.sha256(content).hexdigest()
        )
        with pytest.raises(ValueError, match=FFmpegInstallation.EXECUTABLE_NAME):
            downloader.download(installation, lambda received, total: None)
        assert not installation.is_installed


class TestStartupImports:
    """
    The command line and the FFmpeg check load without torchcodec, which looks for FFmpeg only when imported.
    """

    def test_torchcodec_is_not_imported_before_the_check(self) -> None:
        script: str = (
            "import sys, ovir_gui.cli, ovir_gui.ffmpeg, ovir_gui.__main__; "
            + "sys.exit(1 if 'torchcodec' in sys.modules else 0)"
        )
        completed: subprocess.CompletedProcess[bytes] = subprocess.run(
            [sys.executable, "-c", script], capture_output=True, check=False
        )
        assert completed.returncode == 0, completed.stderr.decode()
