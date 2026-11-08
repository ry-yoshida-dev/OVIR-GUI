import hashlib
import shutil
import zipfile
from collections.abc import Callable
from http.client import HTTPResponse
from pathlib import Path, PurePosixPath
from typing import ClassVar
from urllib.request import urlopen

from .installation import FFmpegInstallation


class FFmpegDownloader:
    """
    Downloads a Windows build of the FFmpeg shared libraries, checks it against its published SHA-256 and installs its
    ``bin`` folder and license.

    The default build is the ``full_build-shared`` archive of gyan.dev, published at
    https://github.com/GyanD/codexffmpeg; it is a GPL build, which includes the H.264 encoder playable copies need.
    """

    VERSION: ClassVar[str] = "9.0.2"
    URL: ClassVar[str] = (
        "https://github.com/GyanD/codexffmpeg/releases/download/9.0.2/ffmpeg-9.0.2-full_build-shared.zip"
    )
    SHA256: ClassVar[str] = "8d31e162f1616e37aab3fa2db991b97e1b8dbeb1c8465fd81a81be16ff91b328"
    SIZE_BYTES: ClassVar[int] = 99_899_672
    SOURCE_PAGE: ClassVar[str] = "https://github.com/GyanD/codexffmpeg"
    LICENSE_NAME: ClassVar[str] = "GPL-3.0"
    LICENSE_FILE_NAME: ClassVar[str] = "LICENSE"
    CHUNK_BYTES: ClassVar[int] = 1 << 20
    TIMEOUT_SECONDS: ClassVar[float] = 60.0

    def __init__(self, url: str = URL, sha256: str = SHA256) -> None:
        """
        Parameters
        ----------
        url : str, optional
            Address of the ZIP archive; the build of ``VERSION`` by default.
        sha256 : str, optional
            Expected SHA-256 of the archive in lowercase hexadecimal.
        """
        self._url: str = url
        self._sha256: str = sha256

    def download(self, installation: FFmpegInstallation, on_progress: Callable[[int, int], None]) -> None:
        """
        Download, check and install the build.

        Parameters
        ----------
        installation : FFmpegInstallation
            Folder receiving the build.
        on_progress : Callable[[int, int], None]
            Called with the received and total byte counts after every chunk.

        Raises
        ------
        ValueError
            If the archive does not match its SHA-256 or holds no FFmpeg executable.
        OSError
            If the archive cannot be downloaded or written.
        """
        installation.directory.mkdir(parents=True, exist_ok=True)
        archive: Path = installation.directory / ".download.zip"
        staging: Path = installation.directory / ".staging"
        try:
            self._fetch(archive, on_progress)
            shutil.rmtree(staging, ignore_errors=True)
            license_file: Path | None = self._extract(archive, staging)
            installation.install(staging / FFmpegInstallation.BIN_DIRECTORY_NAME, license_file)
        finally:
            archive.unlink(missing_ok=True)
            shutil.rmtree(staging, ignore_errors=True)

    def _fetch(self, archive: Path, on_progress: Callable[[int, int], None]) -> None:
        digest = hashlib.sha256()
        response: HTTPResponse = urlopen(self._url, timeout=self.TIMEOUT_SECONDS)
        with response, archive.open("wb") as file:
            total_bytes: int = int(response.headers.get("Content-Length", self.SIZE_BYTES))
            received_bytes: int = 0
            while chunk := response.read(self.CHUNK_BYTES):
                file.write(chunk)
                digest.update(chunk)
                received_bytes += len(chunk)
                on_progress(received_bytes, total_bytes)
        if digest.hexdigest() != self._sha256:
            raise ValueError(f"The downloaded FFmpeg does not match its SHA-256 {self._sha256}.")

    def _extract(self, archive: Path, staging: Path) -> Path | None:
        bin_directory: Path = staging / FFmpegInstallation.BIN_DIRECTORY_NAME
        bin_directory.mkdir(parents=True)
        license_file: Path | None = None
        with zipfile.ZipFile(archive) as bundle:
            for member in bundle.infolist():
                if member.is_dir():
                    continue
                parts: tuple[str, ...] = PurePosixPath(member.filename).parts
                is_binary: bool = len(parts) == 3 and parts[1] == FFmpegInstallation.BIN_DIRECTORY_NAME
                is_license: bool = len(parts) == 2 and parts[1] == self.LICENSE_FILE_NAME
                if not is_binary and not is_license:
                    continue
                target: Path = (bin_directory if is_binary else staging) / parts[-1]
                with bundle.open(member) as source, target.open("wb") as destination:
                    shutil.copyfileobj(source, destination)
                if is_license:
                    license_file = target
        return license_file
