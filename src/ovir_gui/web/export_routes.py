import asyncio
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import ClassVar

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import FileResponse

from ..export import (
    CropImageFormat,
    CropOptions,
    ExportFormat,
    ExportOptions,
    ExportReport,
    LabelPreview,
    LabelPreviewer,
)
from ..media import FrameKey, MediaKind
from ..workspace import ExportCoordinator, ExportPreviewSource, ExportRequest, Workspace
from .json_value import JsonObject
from .schema import ExportBody, ExportPreviewBody, PictureFindings
from .web_context import WebContext


class ExportRoutes:
    """
    Requests exporting the stored results, and downloading the files the last export wrote.
    """

    DEFAULT_ARCHIVE_STEM: ClassVar[str] = "export"

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
        Routes of the export requests.

        Returns
        -------
        APIRouter
            Router under ``/api``.
        """
        router: APIRouter = APIRouter(prefix="/api")
        context: WebContext = self._context

        @router.get("/export/plan")
        async def export_plan(media: str) -> JsonObject:
            workspace: Workspace = context.workspace
            return context.replies.export_plan(
                workspace.exports.plan(MediaKind(media)), ExportCoordinator.default_directory(context.working_directory)
            )

        @router.get("/export/folder")
        async def export_folder(path: str) -> JsonObject:
            directory: Path = Path(path.strip()).expanduser().resolve()
            if directory.exists() and not directory.is_dir():
                raise NotADirectoryError(f"{directory} is a file, not a folder.")
            entry_count: int = (
                await asyncio.to_thread(lambda: sum(1 for _ in directory.iterdir())) if directory.is_dir() else 0
            )
            return {"entry_count": entry_count}

        @router.post("/export/preview")
        async def export_preview(body: ExportPreviewBody) -> JsonObject:
            media_kind: MediaKind = MediaKind(body.media)
            source: ExportPreviewSource = context.workspace.exports.preview_source(
                media_kind, self._listed(media_kind, body.listed_findings)
            )
            previewer: LabelPreviewer = LabelPreviewer(source.media)
            preview: LabelPreview = await asyncio.to_thread(
                previewer.preview,
                source.items,
                source.task,
                source.shown_key,
                ExportFormat(body.export_format),
                body.is_confidence_included,
                CropOptions(
                    image_format=CropImageFormat(body.crop_image_format), margin_percent=body.crop_margin_percent
                ),
                source.class_names,
            )
            return {
                "file_name": preview.file_name,
                "text": preview.text,
                "is_shown_picture_only": preview.is_shown_picture_only,
                "is_truncated": preview.is_truncated,
            }

        @router.post("/export")
        async def export(body: ExportBody) -> JsonObject:
            options: ExportOptions = ExportOptions(
                export_format=ExportFormat(body.export_format),
                output_directory=Path(body.output_directory.strip()).expanduser().resolve(),
                is_confidence_included=body.is_confidence_included,
                is_annotated_image_saved=body.is_annotated_image_saved,
                is_annotated_video_saved=body.is_annotated_video_saved,
                crop_options=CropOptions(
                    image_format=CropImageFormat(body.crop_image_format), margin_percent=body.crop_margin_percent
                ),
            )
            media_kind: MediaKind = MediaKind(body.media)
            request: ExportRequest = ExportRequest(
                options=options,
                media_kind=media_kind,
                listed_indices=self._listed(media_kind, body.listed_findings),
                is_label_confidence_shown=body.is_label_confidence_shown,
            )
            return context.replies.reply(context.workspace.exports.start(request))

        @router.get("/export/download")
        async def download(background_tasks: BackgroundTasks) -> FileResponse:
            report: ExportReport | None = context.workspace.exports.last_export
            if report is None:
                raise KeyError("Nothing has been exported yet.")
            staging_directory: Path = Path(tempfile.mkdtemp())
            background_tasks.add_task(shutil.rmtree, staging_directory, True)
            archive_name: str = f"{report.output_directory.name or self.DEFAULT_ARCHIVE_STEM}.zip"
            archive_path: Path = staging_directory / archive_name
            await asyncio.to_thread(self._zip, report, archive_path)
            return FileResponse(archive_path, filename=archive_name, media_type="application/zip")

        return router

    @staticmethod
    def _listed(
        media_kind: MediaKind, listed_findings: list[PictureFindings] | None
    ) -> dict[FrameKey, frozenset[int]] | None:
        if media_kind is MediaKind.VIDEO:
            return None
        if listed_findings is None:
            raise ValueError("An image export needs the pictures the image table lists.")
        return {key: frozenset(indices) for key, indices in PictureFindings.grouped(listed_findings).items()}

    @staticmethod
    def _zip(report: ExportReport, archive_path: Path) -> None:
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
            for written_path in report.written_paths:
                member: Path = (
                    written_path.relative_to(report.output_directory)
                    if written_path.is_relative_to(report.output_directory)
                    else Path(written_path.name)
                )
                archive.write(written_path, member.as_posix())
