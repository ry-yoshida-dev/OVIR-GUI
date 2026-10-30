import asyncio
from pathlib import Path

from ..models import BenchmarkCatalog
from ..workspace import Workspace
from .directory_browser import DirectoryBrowser
from .event_hub import EventHub
from .object_document_builder import ObjectDocumentBuilder
from .payloads import (
    ClassViewBuilder,
    ModelPanelBuilder,
    PageStateBuilder,
    ReplyBuilder,
    ResultViewBuilder,
    StatisticsViewBuilder,
)
from .picture_preview_cache import PicturePreviewCache
from .reference_draft_store import ReferenceDraftStore


class WebContext:
    """
    What the request handlers share: the workspace, created once the event loop runs, and the helpers around it.
    """

    def __init__(self, working_directory: Path) -> None:
        """
        Parameters
        ----------
        working_directory : Path
            Directory the server was started in, listed first when browsing the server.
        """
        self._workspace: Workspace | None = None
        self.working_directory: Path = working_directory
        self.hub: EventHub = EventHub()
        self.preview_cache: PicturePreviewCache = PicturePreviewCache()
        self.result_views: ResultViewBuilder = ResultViewBuilder()
        self.class_views: ClassViewBuilder = ClassViewBuilder()
        self.statistics_views: StatisticsViewBuilder = StatisticsViewBuilder()
        self.replies: ReplyBuilder = ReplyBuilder()
        self.page_state: PageStateBuilder = PageStateBuilder(
            self.preview_cache, ModelPanelBuilder(BenchmarkCatalog.bundled()), self.class_views, self.result_views
        )
        self.drafts: ReferenceDraftStore = ReferenceDraftStore()
        self.documents: ObjectDocumentBuilder = ObjectDocumentBuilder()
        self.browser: DirectoryBrowser = DirectoryBrowser(working_directory, {})

    @property
    def workspace(self) -> Workspace:
        """
        Workspace of the running server.

        Returns
        -------
        Workspace
            Workspace attached at start.

        Raises
        ------
        RuntimeError
            If the server has not started yet.
        """
        if self._workspace is None:
            raise RuntimeError("The workspace is not ready yet.")
        return self._workspace

    def attach(self, workspace: Workspace) -> None:
        """
        Use the workspace created at start.

        Parameters
        ----------
        workspace : Workspace
            Workspace running on the event loop of the server.
        """
        self._workspace = workspace
        workspace.notifier.add_observer(self.hub)
        self.browser = DirectoryBrowser(
            self.working_directory,
            {
                "Working directory": self.working_directory,
                "Home": Path.home(),
                "Uploads": workspace.stores.upload_store.directory,
            },
        )

    async def media_opened(self) -> None:
        """
        Wait until every file being opened has been added to the workspace.
        """
        opened: asyncio.Future[None] = asyncio.get_running_loop().create_future()
        self.workspace.when_media_opened(lambda: None if opened.done() else opened.set_result(None))
        await opened

    def detach(self) -> None:
        """
        Stop using the workspace, e.g. when the server stops.
        """
        if self._workspace is not None:
            self._workspace.notifier.remove_observer(self.hub)
        self._workspace = None
