import sys
from enum import Enum


class OperatingSystem(Enum):
    """
    Operating system family, deciding how FFmpeg is made available.

    Attributes
    ----------
    WINDOWS : str
        Windows, where OVIR GUI downloads FFmpeg itself.
    MACOS : str
        macOS, where FFmpeg comes from Homebrew.
    LINUX : str
        Linux and other systems, where FFmpeg comes from the package manager.
    """

    WINDOWS = "windows"
    MACOS = "macos"
    LINUX = "linux"

    @classmethod
    def current(cls) -> "OperatingSystem":
        """
        Family of the running system.

        Returns
        -------
        OperatingSystem
            ``WINDOWS``, ``MACOS`` or ``LINUX``.
        """
        if sys.platform == "win32":
            return cls.WINDOWS
        if sys.platform == "darwin":
            return cls.MACOS
        return cls.LINUX

    @property
    def is_ffmpeg_downloadable(self) -> bool:
        """
        Whether OVIR GUI downloads FFmpeg itself on this system.

        Returns
        -------
        bool
            ``True`` on Windows only.
        """
        match self:
            case OperatingSystem.WINDOWS:
                return True
            case OperatingSystem.MACOS | OperatingSystem.LINUX:
                return False

    @property
    def ffmpeg_install_hint(self) -> str:
        """
        How the user makes FFmpeg available.

        Returns
        -------
        str
            Sentence for the terminal and the interface.
        """
        match self:
            case OperatingSystem.WINDOWS:
                return 'Start OVIR GUI with "ovir-gui --download-ffmpeg" to download it.'
            case OperatingSystem.MACOS:
                return 'Install it with "brew install ffmpeg" and start OVIR GUI again.'
            case OperatingSystem.LINUX:
                return (
                    'Install it with your package manager, such as "sudo apt install ffmpeg", '
                    + "and start OVIR GUI again."
                )
