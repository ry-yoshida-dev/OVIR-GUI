import webbrowser
from collections.abc import Sequence
from pathlib import Path
from threading import Timer
from typing import ClassVar

import uvicorn

from ..models import DeviceAvailability, ModelSelector, PresetCatalog
from ..workspace import WorkspaceStores
from .access_guard import AccessGuard
from .embedding_policy import EmbeddingPolicy
from .web_application import WebApplication


class WebLauncher:
    """
    Starts the web server and, when asked, opens the user interface in the default browser.

    The server listens on the loopback interface by default, so only this machine can reach it; on a remote machine,
    forward the port over SSH (``ssh -L 8000:localhost:8000 host``) instead of listening on every interface. The
    printed address carries an access token, created for this run unless one is given; only browsers that opened it can
    use the server. Pages of the embedding origins may show the interface in a frame, e.g. a GIS application opening
    pictures in a window of its own page.
    """

    BROWSER_DELAY_SECONDS: ClassVar[float] = 1.0
    COOKIE_NAME_PREFIX: ClassVar[str] = "ovir_gui_token_"

    def __init__(
        self,
        host: str,
        port: int,
        is_browser_opened: bool,
        data_directory: Path,
        embed_origins: Sequence[str],
        access_token: str | None,
    ) -> None:
        """
        Parameters
        ----------
        host : str
            Interface to listen on, e.g. ``127.0.0.1`` or ``0.0.0.0``.
        port : int
            Port to listen on.
        is_browser_opened : bool
            Whether to open the user interface in the default browser once the server runs.
        data_directory : Path
            Directory keeping classes, results, uploads and the session.
        embed_origins : Sequence[str]
            Origins of the pages allowed to show the interface in a frame, e.g. ``http://localhost:3000``.
        access_token : str | None
            Secret of the printed address; a new one for this run when ``None``.

        Raises
        ------
        ValueError
            If an embedding origin is not an ``http`` or ``https`` origin.
        """
        self._host: str = host
        self._port: int = port
        self._is_browser_opened: bool = is_browser_opened
        self._data_directory: Path = data_directory
        self._embedding_policy: EmbeddingPolicy = EmbeddingPolicy.of(embed_origins)
        self._access_token: str = AccessGuard.new_token() if access_token is None else access_token

    @property
    def url(self) -> str:
        """
        Address of the user interface.

        Returns
        -------
        str
            ``http://<host>:<port>/?token=<access token>``, naming ``localhost`` when listening on every interface.
        """
        shown_host: str = "localhost" if self._host in {"0.0.0.0", "::"} else self._host
        return f"http://{shown_host}:{self._port}/?{AccessGuard.TOKEN_PARAMETER}={self._access_token}"

    def run(self, initial_paths: Sequence[Path]) -> None:
        """
        Serve until interrupted.

        Parameters
        ----------
        initial_paths : Sequence[Path]
            Images, videos or directories opened at start; without any, the media of the last session are opened again.
        """
        print("Probing devices and model presets ...", flush=True)
        application: WebApplication = WebApplication(
            ModelSelector(PresetCatalog.from_packages(), DeviceAvailability.detect()),
            WorkspaceStores.in_directory(self._data_directory),
            initial_paths,
            Path.cwd(),
            self._access_token,
            f"{self.COOKIE_NAME_PREFIX}{self._port}",
            self._embedding_policy,
        )
        print(f"OVIR GUI is running at {self.url}", flush=True)
        if self._embedding_policy.is_embedding_allowed:
            print(f"Pages of {', '.join(self._embedding_policy.parent_origins)} may embed it.", flush=True)
        if self._is_browser_opened:
            Timer(self.BROWSER_DELAY_SECONDS, webbrowser.open, args=(self.url,)).start()
        uvicorn.run(application.build(), host=self._host, port=self._port, log_level="warning")
