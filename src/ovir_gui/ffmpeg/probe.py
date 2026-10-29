import subprocess
import sys
from typing import ClassVar


class FFmpegProbe:
    """
    Tells whether torchcodec finds FFmpeg, checked in a separate Python process.

    torchcodec looks for FFmpeg only once per process, when imported, so the check must not import it here before
    FFmpeg has been made available.
    """

    SCRIPT: ClassVar[str] = "import sys, torchcodec; sys.exit(0 if torchcodec.ffmpeg_major_version is not None else 1)"

    def is_available(self) -> bool:
        """
        Whether torchcodec loads FFmpeg with the current environment variables.

        Returns
        -------
        bool
            ``True`` when torchcodec reports an FFmpeg version.
        """
        completed: subprocess.CompletedProcess[bytes] = subprocess.run(
            [sys.executable, "-c", self.SCRIPT], capture_output=True, check=False
        )
        return completed.returncode == 0
