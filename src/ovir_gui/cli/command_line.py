import argparse
from collections.abc import Sequence
from pathlib import Path
from typing import ClassVar

from ..workspace import WorkspaceStores
from .launch_options import LaunchOptions


class CommandLine:
    """
    Arguments of the ``ovir-gui`` command, which starts the web server.
    """

    DEFAULT_HOST: ClassVar[str] = "127.0.0.1"
    DEFAULT_PORT: ClassVar[int] = 8000

    def __init__(self) -> None:
        self._parser: argparse.ArgumentParser = argparse.ArgumentParser(
            prog="ovir-gui",
            description="Open-vocabulary image recognition GUI (classification, detection, segmentation) "
            + "for images and videos. Starts a web server.",
        )
        self._parser.add_argument(
            "paths",
            nargs="*",
            type=Path,
            help="images, videos or folders to open; the last session is restored without any",
        )
        self._parser.add_argument(
            "--host",
            default=self.DEFAULT_HOST,
            help=f"interface the web server listens on (default {self.DEFAULT_HOST}; 0.0.0.0 exposes it to the network)",
        )
        self._parser.add_argument(
            "--port", type=int, default=self.DEFAULT_PORT, help=f"port of the web server (default {self.DEFAULT_PORT})"
        )
        self._parser.add_argument(
            "--no-browser", action="store_true", help="do not open the interface in the default browser"
        )
        self._parser.add_argument(
            "--data-dir",
            type=Path,
            default=None,
            help=f"directory keeping classes, results and uploads (default ./{WorkspaceStores.DEFAULT_DIRECTORY_NAME})",
        )

    def parse(self, arguments: Sequence[str]) -> LaunchOptions:
        """
        Read the command-line arguments.

        Parameters
        ----------
        arguments : Sequence[str]
            Arguments without the program name.

        Returns
        -------
        LaunchOptions
            What to start.
        """
        namespace: argparse.Namespace = self._parser.parse_args(list(arguments))
        paths: list[Path] = namespace.paths
        host: str = namespace.host
        port: int = namespace.port
        is_browser_disabled: bool = namespace.no_browser
        data_directory: Path | None = namespace.data_dir
        return LaunchOptions(
            paths=tuple(paths),
            host=host,
            port=port,
            is_browser_opened=not is_browser_disabled,
            data_directory=(
                Path.cwd() / WorkspaceStores.DEFAULT_DIRECTORY_NAME
                if data_directory is None
                else data_directory.expanduser().resolve()
            ),
        )
