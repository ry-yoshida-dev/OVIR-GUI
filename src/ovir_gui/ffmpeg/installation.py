import os
import shutil
from pathlib import Path
from typing import ClassVar


class FFmpegInstallation:
    """
    Folder of the user holding the FFmpeg shared libraries downloaded by OVIR GUI, shared by every data directory.

    ```text
    ffmpeg/
    ├── bin/      # ffmpeg.exe and the DLLs torchcodec loads
    ├── LICENSE   # license of the downloaded build
    └── declined  # present once the user declined the download
    ```
    """

    APPLICATION_DIRECTORY_NAME: ClassVar[str] = "ovir-gui"
    DIRECTORY_NAME: ClassVar[str] = "ffmpeg"
    BIN_DIRECTORY_NAME: ClassVar[str] = "bin"
    EXECUTABLE_NAME: ClassVar[str] = "ffmpeg.exe"
    DECLINED_MARKER_NAME: ClassVar[str] = "declined"

    def __init__(self, directory: Path) -> None:
        """
        Parameters
        ----------
        directory : Path
            Folder holding the downloaded build.
        """
        self._directory: Path = directory

    @classmethod
    def of_user(cls) -> "FFmpegInstallation":
        """
        Folder in the local application data of the user, or in the user cache outside Windows.

        Returns
        -------
        FFmpegInstallation
            ``%LOCALAPPDATA%\\ovir-gui\\ffmpeg`` on Windows.
        """
        local_application_data: str | None = os.environ.get("LOCALAPPDATA") or os.environ.get("XDG_CACHE_HOME")
        base: Path = Path.home() / ".cache" if local_application_data is None else Path(local_application_data)
        return cls(base / cls.APPLICATION_DIRECTORY_NAME / cls.DIRECTORY_NAME)

    @property
    def directory(self) -> Path:
        """
        Folder holding the downloaded build.

        Returns
        -------
        Path
            Folder, which may not exist yet.
        """
        return self._directory

    @property
    def bin_directory(self) -> Path:
        """
        Folder of the executable and its DLLs.

        Returns
        -------
        Path
            ``bin`` of the folder.
        """
        return self._directory / self.BIN_DIRECTORY_NAME

    @property
    def is_installed(self) -> bool:
        """
        Whether a downloaded build is present.

        Returns
        -------
        bool
            ``True`` when the executable exists.
        """
        return (self.bin_directory / self.EXECUTABLE_NAME).is_file()

    @property
    def is_declined(self) -> bool:
        """
        Whether the user declined the download, so it is not offered at every start.

        Returns
        -------
        bool
            ``True`` once declined until a build is downloaded.
        """
        return (self._directory / self.DECLINED_MARKER_NAME).is_file()

    def remember_declined(self) -> None:
        """
        Remember that the user declined the download.
        """
        self._directory.mkdir(parents=True, exist_ok=True)
        (self._directory / self.DECLINED_MARKER_NAME).touch()

    def install(self, bin_directory: Path, license_file: Path | None) -> None:
        """
        Move an extracted build into the folder, replacing a previous one.

        Parameters
        ----------
        bin_directory : Path
            Extracted folder of the executable and its DLLs, on the same drive as the folder.
        license_file : Path | None
            Extracted license of the build; ``None`` when the archive holds none.

        Raises
        ------
        ValueError
            If ``bin_directory`` holds no FFmpeg executable.
        """
        if not (bin_directory / self.EXECUTABLE_NAME).is_file():
            raise ValueError(f"The downloaded FFmpeg holds no {self.EXECUTABLE_NAME}.")
        self._directory.mkdir(parents=True, exist_ok=True)
        shutil.rmtree(self.bin_directory, ignore_errors=True)
        bin_directory.replace(self.bin_directory)
        if license_file is not None:
            license_file.replace(self._directory / license_file.name)
        (self._directory / self.DECLINED_MARKER_NAME).unlink(missing_ok=True)

    def expose(self) -> None:
        """
        Put the downloaded build first on ``PATH``, where torchcodec looks for the FFmpeg DLLs when imported.
        """
        search_path: str = os.environ.get("PATH", "")
        os.environ["PATH"] = os.pathsep.join(part for part in (str(self.bin_directory), search_path) if part != "")
