import sys
from typing import ClassVar

from .downloader import FFmpegDownloader
from .installation import FFmpegInstallation
from .operating_system import OperatingSystem
from .probe import FFmpegProbe


class FFmpegStartupCheck:
    """
    Makes FFmpeg available at start, before torchcodec is imported: uses the build downloaded earlier, else checks the
    FFmpeg of the computer and, on Windows, offers to download one in the terminal.

    FFmpeg only encodes the browser-playable copies of videos; without it they are shown as frames decoded by the
    server and inference works as before. A declined download is not offered again until asked for with
    ``--download-ffmpeg``, and without a terminal to answer in nothing is asked.
    """

    PROGRESS_BAR_WIDTH: ClassVar[int] = 30
    BYTES_PER_MEGABYTE: ClassVar[float] = 1_000_000.0

    def __init__(
        self,
        installation: FFmpegInstallation,
        downloader: FFmpegDownloader,
        probe: FFmpegProbe,
        operating_system: OperatingSystem,
        is_interactive: bool,
    ) -> None:
        """
        Parameters
        ----------
        installation : FFmpegInstallation
            Folder of the downloaded build.
        downloader : FFmpegDownloader
            Source of the build.
        probe : FFmpegProbe
            Check of the FFmpeg torchcodec finds.
        operating_system : OperatingSystem
            Running system.
        is_interactive : bool
            Whether the user can answer in a terminal.
        """
        self._installation: FFmpegInstallation = installation
        self._downloader: FFmpegDownloader = downloader
        self._probe: FFmpegProbe = probe
        self._operating_system: OperatingSystem = operating_system
        self._is_interactive: bool = is_interactive
        self._shown_percent: int = -1

    @classmethod
    def of_current_process(cls) -> "FFmpegStartupCheck":
        """
        Check for the user and terminal of this process.

        Returns
        -------
        FFmpegStartupCheck
            Check downloading the default build into the folder of the user.
        """
        return cls(
            FFmpegInstallation.of_user(),
            FFmpegDownloader(),
            FFmpegProbe(),
            OperatingSystem.current(),
            sys.stdin.isatty(),
        )

    def run(self, is_download_requested: bool) -> None:
        """
        Make FFmpeg available, downloading it when asked or accepted.

        Parameters
        ----------
        is_download_requested : bool
            Whether ``--download-ffmpeg`` asks for the download without a question.
        """
        if self._installation.is_installed:
            self._installation.expose()
            if is_download_requested:
                print(f"FFmpeg is already downloaded to {self._installation.directory}.", flush=True)
            return
        if is_download_requested and self._operating_system.is_ffmpeg_downloadable:
            self._download()
            return
        if is_download_requested:
            print(f"FFmpeg is downloaded only on Windows. {self._operating_system.ffmpeg_install_hint}", flush=True)
        if self._probe.is_available():
            return
        if not self._is_offered():
            print(
                "FFmpeg was not found, so videos the browser cannot play are shown as still frames. "
                + self._operating_system.ffmpeg_install_hint,
                flush=True,
            )
            return
        print(self._offer(), flush=True)
        if self._is_accepted():
            self._download()
            return
        self._installation.remember_declined()
        print(f"Skipped. {self._operating_system.ffmpeg_install_hint}", flush=True)

    def _is_offered(self) -> bool:
        is_downloadable: bool = self._operating_system.is_ffmpeg_downloadable
        return is_downloadable and self._is_interactive and not self._installation.is_declined

    def _offer(self) -> str:
        size_megabytes: float = round(FFmpegDownloader.SIZE_BYTES / self.BYTES_PER_MEGABYTE, -1)
        return (
            "FFmpeg was not found. Without it, videos the browser cannot play (such as ProRes)\n"
            + "are shown as still frames; detection and other inference work either way.\n\n"
            + f"Download FFmpeg {FFmpegDownloader.VERSION} (about {size_megabytes:.0f} MB) "
            + f"from {FFmpegDownloader.SOURCE_PAGE} ?\n"
            + f"It is licensed under {FFmpegDownloader.LICENSE_NAME} and is saved to\n"
            + f"{self._installation.directory} (delete that folder to remove it)."
        )

    def _is_accepted(self) -> bool:
        try:
            answer: str = input("[Y/n] ")
        except EOFError:
            return False
        return answer.strip().lower() in {"", "y", "yes"}

    def _download(self) -> None:
        self._shown_percent = -1
        try:
            self._downloader.download(self._installation, self._show_progress)
        except (OSError, ValueError) as error:
            print(
                f"\nFFmpeg could not be downloaded: {error}\n{self._operating_system.ffmpeg_install_hint}",
                flush=True,
            )
            return
        print("", flush=True)
        self._installation.expose()
        if self._probe.is_available():
            print("FFmpeg is ready.", flush=True)
            return
        print(
            f"FFmpeg was downloaded to {self._installation.directory}, but torchcodec cannot load it; "
            + "videos the browser cannot play are shown as still frames.",
            flush=True,
        )

    def _show_progress(self, received_bytes: int, total_bytes: int) -> None:
        fraction: float = min(1.0, received_bytes / max(1, total_bytes))
        percent: int = int(100 * fraction)
        if percent == self._shown_percent:
            return
        self._shown_percent = percent
        filled_width: int = int(self.PROGRESS_BAR_WIDTH * fraction)
        bar: str = "#" * filled_width + "-" * (self.PROGRESS_BAR_WIDTH - filled_width)
        received_megabytes: float = received_bytes / self.BYTES_PER_MEGABYTE
        total_megabytes: float = total_bytes / self.BYTES_PER_MEGABYTE
        print(
            f"\rDownloading FFmpeg  {received_megabytes:5.1f} / {total_megabytes:.1f} MB  [{bar}] {percent:3d}%",
            end="",
            flush=True,
        )
