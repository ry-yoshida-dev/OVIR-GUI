import asyncio
import logging
from collections.abc import AsyncGenerator, Sequence
from contextlib import asynccontextmanager
from pathlib import Path
from typing import ClassVar

from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from ..models import ModelSelector, RecognizerSession
from ..workspace import Workspace, WorkspaceStores
from .access_guard import AccessGuard
from .asyncio_task_scheduler import AsyncioTaskScheduler
from .class_routes import ClassRoutes
from .embedding_policy import EmbeddingPolicy
from .embedding_routes import EmbeddingRoutes
from .export_routes import ExportRoutes
from .framing_headers import FramingHeaders
from .media_routes import MediaRoutes
from .picture_prompt_routes import PicturePromptRoutes
from .recognition_routes import RecognitionRoutes
from .web_context import WebContext

LOGGER: logging.Logger = logging.getLogger(__name__)


class WebApplication:
    """
    Web server of the application: a JSON API over the workspace, a WebSocket telling the browsers what changed, and
    the single-page user interface built into ``static``.

    The workspace is created when the server starts, on its event loop, and shut down with it: inference and the
    encoding of playable copies stop, the current mini-batch, outcomes and exports in flight are awaited for up to
    ``SHUTDOWN_WAIT_SECONDS`` each, and the results and the session are saved. Errors caused by the request, such as
    an invalid class name or an unknown image, are answered with status 400 and their message. Only a browser that
    opened the address with the access token can use the server (see ``AccessGuard``), and only pages of the server
    and of the parent origins of the embedding policy may show it in a frame (see ``FramingHeaders``).
    """

    STATIC_DIRECTORY: ClassVar[Path] = Path(__file__).parent / "static"
    SHUTDOWN_WAIT_SECONDS: ClassVar[float] = 60.0
    MISSING_FRONTEND_PAGE: ClassVar[str] = (
        "<!doctype html><title>OVIR GUI</title><h1>OVIR GUI</h1>"
        + "<p>The web interface has not been built. Run <code>npm install && npm run build</code> in "
        + "<code>frontend/</code>; the API is served under <code>/api</code>.</p>"
    )

    def __init__(
        self,
        model_selector: ModelSelector,
        stores: WorkspaceStores,
        initial_paths: Sequence[Path],
        working_directory: Path,
        access_token: str,
        cookie_name: str,
        embedding_policy: EmbeddingPolicy,
        session: RecognizerSession | None = None,
    ) -> None:
        """
        Parameters
        ----------
        model_selector : ModelSelector
            Presets of every task and the devices of this machine.
        stores : WorkspaceStores
            Data directories of the workspace.
        initial_paths : Sequence[Path]
            Images, videos or directories opened at start; without any, the media of the last session are opened again.
        working_directory : Path
            Directory the server was started in.
        access_token : str
            Secret a browser presents once, in the ``token`` query parameter, to use the server.
        cookie_name : str
            Name of the cookie keeping the access token in the browser.
        embedding_policy : EmbeddingPolicy
            Pages of other applications allowed to show the interface in a frame.
        session : RecognizerSession | None, optional
            Session keeping the loaded model; a new one by default.
        """
        self._model_selector: ModelSelector = model_selector
        self._embedding_policy: EmbeddingPolicy = embedding_policy
        self._stores: WorkspaceStores = stores
        self._initial_paths: tuple[Path, ...] = tuple(initial_paths)
        self._session: RecognizerSession | None = session
        self._access_token: str = access_token
        self._cookie_name: str = cookie_name
        self._context: WebContext = WebContext(working_directory)

    @property
    def context(self) -> WebContext:
        """
        Workspace and helpers shared by the request handlers.

        Returns
        -------
        WebContext
            Context of the application.
        """
        return self._context

    def build(self) -> FastAPI:
        """
        Assemble the ASGI application.

        Returns
        -------
        FastAPI
            Application serving the API, the event WebSocket and the user interface.
        """
        application: FastAPI = FastAPI(title="OVIR GUI", lifespan=self._lifespan)
        application.add_middleware(AccessGuard, token=self._access_token, cookie_name=self._cookie_name)
        application.add_middleware(FramingHeaders, policy=self._embedding_policy)
        for error_type in (ValueError, KeyError, IndexError, OSError, ModuleNotFoundError):
            application.add_exception_handler(error_type, self._client_error)
        for routes in (
            MediaRoutes(self._context),
            RecognitionRoutes(self._context),
            ClassRoutes(self._context),
            PicturePromptRoutes(self._context),
            ExportRoutes(self._context),
            EmbeddingRoutes(self._context, self._embedding_policy),
        ):
            application.include_router(routes.router())
        context: WebContext = self._context

        @application.websocket("/api/events")
        async def events(socket: WebSocket) -> None:
            await context.hub.serve(socket)

        if (self.STATIC_DIRECTORY / "index.html").is_file():
            application.mount("/", StaticFiles(directory=self.STATIC_DIRECTORY, html=True), name="static")
        else:

            @application.get("/")
            async def missing_frontend() -> HTMLResponse:
                return HTMLResponse(self.MISSING_FRONTEND_PAGE)

        return application

    @asynccontextmanager
    async def _lifespan(self, application: FastAPI) -> AsyncGenerator[None]:
        scheduler: AsyncioTaskScheduler = AsyncioTaskScheduler(asyncio.get_running_loop())
        workspace: Workspace = Workspace(self._model_selector, self._stores, scheduler, self._session)
        self._context.attach(workspace)
        if self._initial_paths:
            workspace.open_paths(self._initial_paths)
        else:
            workspace.restore_session()
        await self._context.media_opened()
        try:
            yield
        finally:
            self._context.detach()
            workspace.playback.stop()
            workspace.jobs.stop()
            is_worker_quit: bool = await asyncio.to_thread(workspace.jobs.join, self.SHUTDOWN_WAIT_SECONDS)
            if not is_worker_quit:
                LOGGER.warning(
                    "Inference did not stop within %s seconds; quitting without it.", self.SHUTDOWN_WAIT_SECONDS
                )
            await scheduler.settle(self.SHUTDOWN_WAIT_SECONDS)
            workspace.save_now()

    @staticmethod
    async def _client_error(request: Request, error: Exception) -> JSONResponse:
        message: str = str(error.args[0]) if isinstance(error, KeyError) and error.args else str(error)
        return JSONResponse(status_code=400, content={"detail": message})
