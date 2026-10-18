import asyncio
import mimetypes
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Query, Response, UploadFile
from fastapi.responses import FileResponse

from ..media import MediaItem
from ..workspace import BackgroundScope, Workspace
from .image_preview import ImagePreview
from .json_value import JsonObject
from .schema import BackgroundBody, PathsBody, SamplingBody, ShowBody
from .web_context import WebContext


class MediaRoutes:
    """
    Requests opening, closing, showing and uploading images and videos, their previews, the video files played in the
    browser, video sampling, background recognition and server folder listings.
    """

    PREVIEW_CACHE_CONTROL = "private, max-age=86400"
    VIDEO_CACHE_CONTROL = "private, no-cache"
    FALLBACK_VIDEO_MEDIA_TYPE = "application/octet-stream"

    def __init__(self, context: WebContext) -> None:
        """
        Parameters
        ----------
        context : WebContext
            Shared workspace and helpers.
        """
        self._context: WebContext = context

    def router(self) -> APIRouter:
        """
        Routes of the media requests.

        Returns
        -------
        APIRouter
            Router under ``/api``.
        """
        router: APIRouter = APIRouter(prefix="/api")
        context: WebContext = self._context

        @router.post("/media/open")
        async def open_media(body: PathsBody) -> JsonObject:
            workspace: Workspace = context.workspace
            paths: list[Path] = [Path(path).expanduser() for path in body.paths]
            workspace.open_paths(paths)
            return {}

        @router.post("/media/close")
        async def close_media(body: PathsBody) -> JsonObject:
            context.workspace.close_media([Path(path) for path in body.paths])
            return {}

        @router.post("/media/show")
        async def show(body: ShowBody) -> JsonObject:
            context.workspace.show(Path(body.path), body.frame)
            return {}

        @router.put("/sampling")
        async def set_sampling(body: SamplingBody) -> JsonObject:
            context.workspace.set_sampling(body.frame_step)
            return {}

        @router.put("/background")
        async def set_background(body: BackgroundBody) -> JsonObject:
            context.workspace.set_background_scope(BackgroundScope(body.scope))
            return {}

        @router.post("/uploads")
        async def upload(
            files: Annotated[list[UploadFile], File()], is_first_shown: Annotated[bool, Query()] = True
        ) -> JsonObject:
            workspace: Workspace = context.workspace
            saved_paths: list[Path] = []
            for upload_file in files:
                content: bytes = await upload_file.read()
                saved_paths.append(
                    await asyncio.to_thread(workspace.stores.upload_store.save, upload_file.filename or "", content)
                )
            workspace.open_paths(saved_paths, is_first_shown)
            return {}

        @router.get("/media/image")
        async def image(path: str) -> Response:
            item: MediaItem = context.workspace.media_item(Path(path))
            preview: ImagePreview = await asyncio.to_thread(context.preview_cache.image_preview, item.path)
            return self._response(preview)

        @router.get("/media/frame")
        async def frame(path: str, frame: int) -> Response:
            item: MediaItem = context.workspace.media_item(Path(path))
            preview: ImagePreview = await asyncio.to_thread(context.preview_cache.frame_preview, item, frame)
            return self._response(preview)

        @router.get("/media/video")
        async def video(path: str) -> FileResponse:
            item: MediaItem = context.workspace.media_item(Path(path))
            _ = item.video_info
            media_type: str | None = mimetypes.guess_type(item.path.name)[0]
            return FileResponse(
                item.path,
                media_type=media_type or self.FALLBACK_VIDEO_MEDIA_TYPE,
                headers={"Cache-Control": self.VIDEO_CACHE_CONTROL},
            )

        @router.get("/files")
        async def files(path: Annotated[str | None, Query()] = None) -> JsonObject:
            return await asyncio.to_thread(context.browser.listing_of, None if path is None else Path(path))

        return router

    def _response(self, preview: ImagePreview) -> Response:
        return Response(
            content=preview.content,
            media_type=preview.media_type,
            headers={"Cache-Control": self.PREVIEW_CACHE_CONTROL},
        )
