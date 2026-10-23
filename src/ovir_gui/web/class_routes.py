import asyncio
from pathlib import Path
from typing import Annotated, ClassVar

from fastapi import APIRouter, File, Response, UploadFile
from fastapi.responses import FileResponse
from PIL import Image

from ..media import FrameKey, LoadedImage, MediaItem, VideoFrameReader
from ..prompting import ReferenceBox, ReferenceImage
from ..storage import ClassSet
from ..vocabulary import ClassDefinition
from ..workspace import Workspace
from .box_corners import BoxCorners
from .image_preview import ImagePreview
from .json_value import JsonObject
from .picture_preview_cache import PicturePreviewCache
from .reference_draft import ReferenceDraft
from .schema import (
    ClassRowBody,
    MovePhraseBody,
    MoveReferenceBody,
    NameBody,
    PathBody,
    ReferenceBoxesBody,
    RemoveClassesBody,
    TextBody,
)
from .temporary_upload import TemporaryUpload
from .web_context import WebContext


class ClassRoutes:
    """
    Requests editing the classes, their phrases and reference images, and the saved class sets.
    """

    THUMBNAIL_SIDE: ClassVar[int] = 1024

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
        Routes of the class requests.

        Returns
        -------
        APIRouter
            Router under ``/api``.
        """
        router: APIRouter = APIRouter(prefix="/api")
        context: WebContext = self._context

        @router.post("/classes/rows")
        async def add_row(body: ClassRowBody) -> JsonObject:
            class_index: int | None = body.class_index
            if class_index is None:
                context.workspace.edit_classes(lambda bench: bench.add_class(body.position, body.text))
            else:
                context.workspace.edit_classes(lambda bench: bench.add_phrases(class_index, body.position, body.text))
            return {}

        @router.put("/classes/{class_index}/name")
        async def rename_class(class_index: int, body: NameBody) -> JsonObject:
            context.workspace.edit_classes(lambda bench: bench.rename_class(class_index, body.name))
            return {}

        @router.put("/classes/{class_index}/phrases/{phrase_index}")
        async def rename_phrase(class_index: int, phrase_index: int, body: TextBody) -> JsonObject:
            context.workspace.edit_classes(lambda bench: bench.rename_phrase(class_index, phrase_index, body.text))
            return {}

        @router.post("/classes/remove")
        async def remove(body: RemoveClassesBody) -> JsonObject:
            phrase_indices: dict[int, list[int]] = {}
            for phrase in body.phrases:
                phrase_indices.setdefault(phrase.class_index, []).append(phrase.phrase_index)
            references: list[tuple[int, ReferenceImage]] = [
                (reference.class_index, ReferenceImage(name=reference.name, digest=reference.digest))
                for reference in body.references
            ]
            context.workspace.edit_classes(lambda bench: bench.remove(body.class_indices, phrase_indices, references))
            return {}

        @router.post("/classes/move-phrase")
        async def move_phrase(body: MovePhraseBody) -> JsonObject:
            target_class_index: int | None = body.target_class_index
            if target_class_index is None:
                context.workspace.edit_classes(
                    lambda bench: bench.promote_phrase(body.class_index, body.phrase_index, body.position)
                )
            else:
                context.workspace.edit_classes(
                    lambda bench: bench.move_phrase(
                        body.class_index, body.phrase_index, target_class_index, body.position
                    )
                )
            return {}

        @router.post("/classes/move-reference")
        async def move_reference(body: MoveReferenceBody) -> JsonObject:
            reference_image: ReferenceImage = ReferenceImage(name=body.name, digest=body.digest)
            context.workspace.edit_classes(
                lambda bench: bench.move_reference_image(body.class_index, reference_image, body.target_class_index)
            )
            return {}

        @router.put("/classes/text")
        async def replace_classes(body: TextBody) -> JsonObject:
            definitions: tuple[ClassDefinition, ...] = tuple(
                ClassDefinition.parse(line) for line in body.text.splitlines() if line.strip()
            )
            context.workspace.edit_classes(lambda bench: bench.set_classes(definitions))
            return {}

        @router.post("/classes/clear")
        async def clear_classes() -> JsonObject:
            context.workspace.edit_classes(lambda bench: bench.set_classes(()))
            return {}

        @router.post("/classes/file")
        async def load_class_file(file: Annotated[UploadFile, File()]) -> JsonObject:
            async with TemporaryUpload.saved(file, "classes.txt") as path:
                context.workspace.edit_classes(lambda bench: bench.load_file(path, path.name))
            return {}

        @router.get("/references/image")
        async def reference_image(name: str, digest: str) -> Response:
            pixels: Image.Image = context.workspace.workbench.reference_board.pixels_of(
                ReferenceImage(name=name, digest=digest)
            )
            return await self._image_response(pixels, self.THUMBNAIL_SIDE)

        @router.post("/references/drafts")
        async def upload_reference(file: Annotated[UploadFile, File()]) -> JsonObject:
            async with TemporaryUpload.saved(file, "reference") as path:
                loaded: LoadedImage = await asyncio.to_thread(LoadedImage.open, path)
            return self._draft_payload(context.drafts.add(path.name, loaded.image))

        @router.post("/references/drafts/path")
        async def open_reference(body: PathBody) -> JsonObject:
            path: Path = Path(body.path).expanduser()
            loaded: LoadedImage = await asyncio.to_thread(LoadedImage.open, path)
            return self._draft_payload(context.drafts.add(path.name, loaded.image))

        @router.post("/references/drafts/current")
        async def current_reference() -> JsonObject:
            workspace: Workspace = context.workspace
            frame_key: FrameKey | None = workspace.current_key
            if frame_key is None:
                raise ValueError("Open an image or a video first.")
            item: MediaItem = workspace.media_item(frame_key.path)
            pixels: Image.Image
            name: str
            if item.video is None or frame_key.frame_index is None:
                pixels = (await asyncio.to_thread(LoadedImage.open, item.path)).image
                name = item.path.name
            else:
                reader: VideoFrameReader = VideoFrameReader(item.path, item.video)
                pixels = await asyncio.to_thread(reader.read_one, frame_key.frame_index)
                name = f"{item.path.stem}_f{frame_key.frame_index:06d}.png"
            return self._draft_payload(context.drafts.add(name, pixels))

        @router.get("/references/drafts/{draft_id}/image")
        async def draft_image(draft_id: str) -> Response:
            return await self._image_response(context.drafts.get(draft_id).image, PicturePreviewCache.IMAGE_MAX_SIDE)

        @router.post("/references")
        async def add_reference(body: ReferenceBoxesBody) -> JsonObject:
            workspace: Workspace = context.workspace
            draft: ReferenceDraft = context.drafts.get(body.draft_id)
            class_names: tuple[str, ...] = workspace.workbench.class_names
            if not 0 <= body.class_index < len(class_names):
                raise IndexError(f"No class {body.class_index}.")
            width, height = draft.image.size
            corners: tuple[BoxCorners, ...] = tuple(
                BoxCorners.of(value).clamped(float(width), float(height))
                for value in body.boxes or [[0.0, 0.0, float(width), float(height)]]
            )
            reference: ReferenceImage = ReferenceImage.of(draft.name, draft.image)
            boxes: tuple[ReferenceBox, ...] = tuple(
                ReferenceBox(
                    reference_image=reference,
                    class_name=class_names[body.class_index],
                    left=corner.left,
                    top=corner.top,
                    right=corner.right,
                    bottom=corner.bottom,
                )
                for corner in corners
            )
            workspace.edit_classes(lambda bench: bench.add_reference_boxes(boxes, draft.image))
            context.drafts.discard(body.draft_id)
            return {}

        @router.get("/class-sets")
        async def class_sets() -> JsonObject:
            return context.class_views.class_set_entries(context.workspace.workbench.class_set_store.entries)

        @router.get("/class-sets/{name}")
        async def class_set_preview(name: str) -> JsonObject:
            class_set: ClassSet = await asyncio.to_thread(
                context.workspace.workbench.class_set_store.read_class_set, name
            )
            return context.class_views.class_set_preview(name, class_set)

        @router.get("/class-sets/{name}/image")
        async def class_set_image(name: str, image_name: str, digest: str) -> Response:
            class_set: ClassSet = await asyncio.to_thread(
                context.workspace.workbench.class_set_store.read_class_set, name
            )
            return await self._image_response(
                class_set.reference_pixels[ReferenceImage(name=image_name, digest=digest)], self.THUMBNAIL_SIDE
            )

        @router.post("/class-sets/save")
        async def save_class_set(body: NameBody) -> JsonObject:
            context.workspace.edit_class_sets(lambda bench: bench.save_class_set(body.name))
            return {}

        @router.post("/class-sets/load")
        async def load_class_set(body: NameBody) -> JsonObject:
            context.workspace.edit_classes(lambda bench: bench.load_class_set(body.name))
            return {}

        @router.put("/class-sets/{name}")
        async def rename_class_set(name: str, body: NameBody) -> JsonObject:
            context.workspace.edit_class_sets(lambda bench: bench.rename_class_set(name, body.name))
            return {}

        @router.delete("/class-sets/{name}")
        async def delete_class_set(name: str) -> JsonObject:
            context.workspace.edit_class_sets(lambda bench: bench.class_set_store.delete_class_set(name))
            return {}

        @router.post("/class-sets/import")
        async def import_class_set(file: Annotated[UploadFile, File()]) -> JsonObject:
            async with TemporaryUpload.saved(file, "classes.ovirset") as path:
                context.workspace.edit_class_sets(lambda bench: bench.class_set_store.import_archive(path, path.stem))
            return {}

        @router.get("/class-sets/{name}/file")
        async def export_class_set(name: str) -> FileResponse:
            path: Path = context.workspace.workbench.class_set_store.path_of(name)
            if not path.is_file():
                raise KeyError(f"No class set named '{name}'.")
            return FileResponse(path, filename=path.name, media_type="application/zip")

        return router

    @staticmethod
    def _draft_payload(draft: ReferenceDraft) -> JsonObject:
        width, height = draft.image.size
        return {"draft_id": draft.draft_id, "name": draft.name, "width": width, "height": height}

    @staticmethod
    async def _image_response(pixels: Image.Image, max_side: int) -> Response:
        preview: ImagePreview = await asyncio.to_thread(PicturePreviewCache.encode, pixels, max_side)
        return preview.response()
