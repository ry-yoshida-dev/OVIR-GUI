import asyncio
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import ClassVar

from fastapi import APIRouter, BackgroundTasks
from fastapi.responses import FileResponse

from ..export import ExportFormat, ExportOptions, ExportReport, ExportScope
from ..media import FrameKey
from ..workspace import ExportCoordinator, ExportRequest, Workspace
from .json_value import JsonObject
from .schema import ExportBody
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
        async def export_plan() -> JsonObject:
            workspace: Workspace = context.workspace
            return context.payloads.export_plan(
                workspace.export_plan(), ExportCoordinator.default_directory(context.working_directory)
            )

        @router.post("/export")
        async def export(body: ExportBody) -> JsonObject:
            options: ExportOptions = ExportOptions(
                export_format=ExportFormat(body.export_format),
                output_directory=Path(body.output_directory.strip()).expanduser().resolve(),
                is_confidence_included=body.is_confidence_included,
                scope=ExportScope(body.scope),
                minimum_confidence=body.minimum_confidence,
                is_annotated_image_saved=body.is_annotated_image_saved,
                is_annotated_video_saved=body.is_annotated_video_saved,
            )
            listed: dict[FrameKey, frozenset[int]] | None = None
            if body.listed_findings is not None:
                listed = {}
                for group in body.listed_findings:
                    key: FrameKey = FrameKey(Path(group.path), group.frame)
                    listed[key] = listed.get(key, frozenset()) | frozenset(group.indices)
            request: ExportRequest = ExportRequest(
                options=options, listed_indices=listed, is_label_confidence_shown=body.is_label_confidence_shown
            )
            return context.payloads.reply(context.workspace.export(request, body.is_skipping_approved))

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
    def _zip(report: ExportReport, archive_path: Path) -> None:
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
            for written_path in report.written_paths:
                member: Path = (
                    written_path.relative_to(report.output_directory)
                    if written_path.is_relative_to(report.output_directory)
                    else Path(written_path.name)
                )
                archive.write(written_path, member.as_posix())
