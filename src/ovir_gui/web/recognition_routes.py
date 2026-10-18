import asyncio
from pathlib import Path

from fastapi import APIRouter, Response

from ..export import ListedFindingsWriter
from ..media import FrameKey
from ..models import ComputeDevice, ComputePrecision, ModelProfile, ModelSelection
from ..recognition import RecognitionTask
from ..results import ResultCatalog
from ..review import ClassThresholds
from ..workspace import Workspace
from .json_value import JsonObject
from .schema import (
    AcceptanceBody,
    ApprovalBody,
    ModelSelectionBody,
    PresetBody,
    ProfileBody,
    TableBody,
    TaskBody,
    ThresholdsBody,
)
from .web_context import WebContext


class RecognitionRoutes:
    """
    Requests reading the state, choosing the task and model, running recognitions, and reviewing and comparing the
    stored results.
    """

    CSV_FILE_NAME = "findings.csv"

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
        Routes of the recognition requests.

        Returns
        -------
        APIRouter
            Router under ``/api``.
        """
        router: APIRouter = APIRouter(prefix="/api")
        context: WebContext = self._context

        @router.get("/state")
        async def state() -> JsonObject:
            return context.payloads.state(context.workspace)

        @router.get("/results")
        async def results() -> JsonObject:
            return context.payloads.results(context.workspace)

        @router.get("/frame")
        async def frame(path: str, frame: int | None = None) -> JsonObject:
            return context.payloads.frame(context.workspace, Path(path), frame)

        @router.get("/video-frames")
        async def video_frames(path: str) -> JsonObject:
            return context.payloads.video_frames(context.workspace, Path(path))

        @router.get("/timeline")
        async def timeline(path: str) -> JsonObject:
            return context.payloads.timeline(context.workspace, Path(path))

        @router.get("/statistics")
        async def statistics() -> JsonObject:
            return context.payloads.statistics(context.workspace)

        @router.put("/task")
        async def select_task(body: TaskBody) -> JsonObject:
            context.workspace.select_task(RecognitionTask(body.task))
            return {}

        @router.put("/model")
        async def select_model(body: ModelSelectionBody) -> JsonObject:
            workspace: Workspace = context.workspace
            workspace.select_model(
                ModelSelection(
                    task=workspace.task,
                    backend=body.backend,
                    preset_name=body.preset_name,
                    device=ComputeDevice(body.device),
                    precision=ComputePrecision(body.precision),
                    confidence_threshold=body.confidence_threshold,
                    nms_iou_threshold=body.nms_iou_threshold,
                    image_pooling=body.image_pooling,
                    box_detector_label=body.box_detector_label,
                    box_confidence_threshold=body.box_confidence_threshold,
                    tiling_grid_size=body.tiling_grid_size,
                )
            )
            return {}

        @router.put("/model/preset")
        async def select_preset(body: PresetBody) -> JsonObject:
            context.workspace.select_preset(body.backend, body.preset_name)
            return {}

        @router.post("/run")
        async def run(body: ApprovalBody) -> JsonObject:
            return context.payloads.reply(context.workspace.run_current(body.is_skipping_approved))

        @router.post("/run-media")
        async def run_media(body: ApprovalBody) -> JsonObject:
            return context.payloads.reply(context.workspace.run_media(body.is_skipping_approved))

        @router.post("/run-all")
        async def run_all(body: ApprovalBody) -> JsonObject:
            return context.payloads.reply(context.workspace.run_all(body.is_skipping_approved))

        @router.post("/update-outdated")
        async def update_outdated(body: ApprovalBody) -> JsonObject:
            return context.payloads.reply(context.workspace.update_outdated(body.is_skipping_approved))

        @router.post("/cancel")
        async def cancel() -> JsonObject:
            context.workspace.cancel()
            return {}

        @router.post("/profiles/select")
        async def select_profile(body: ProfileBody) -> JsonObject:
            workspace: Workspace = context.workspace
            workspace.select_profile(self._profile_of(workspace, body))
            return {}

        @router.post("/profiles/remove")
        async def remove_profile(body: ProfileBody) -> JsonObject:
            workspace: Workspace = context.workspace
            workspace.remove_profile(self._profile_of(workspace, body))
            return {}

        @router.post("/profiles/clear")
        async def clear_results() -> JsonObject:
            context.workspace.clear_results()
            return {}

        @router.put("/comparison")
        async def compare(body: ProfileBody) -> JsonObject:
            workspace: Workspace = context.workspace
            workspace.compare_with(None if body.key is None else self._profile_of(workspace, body))
            return {}

        @router.post("/findings/acceptance")
        async def set_acceptance(body: AcceptanceBody) -> JsonObject:
            findings: dict[FrameKey, list[int]] = {}
            for group in body.findings:
                findings.setdefault(FrameKey(Path(group.path), group.frame), []).extend(group.indices)
            context.workspace.set_accepted(findings, body.is_accepted)
            return {}

        @router.put("/thresholds")
        async def set_thresholds(body: ThresholdsBody) -> JsonObject:
            context.workspace.set_class_thresholds(ClassThresholds(body.default_minimum, body.class_minimums))
            return {}

        @router.post("/findings/csv")
        async def table_csv(body: TableBody) -> Response:
            workspace: Workspace = context.workspace
            catalog: ResultCatalog | None = workspace.shown_catalog()
            if catalog is None:
                raise KeyError("No results are shown.")
            writer: ListedFindingsWriter = ListedFindingsWriter(catalog, {item.path: item for item in workspace.media})
            rows: list[tuple[FrameKey, int]] = [
                (FrameKey(Path(reference.path), reference.frame), reference.index) for reference in body.findings
            ]
            content: bytes = await asyncio.to_thread(writer.write, rows)
            return Response(
                content=content,
                media_type="text/csv",
                headers={"Content-Disposition": f'attachment; filename="{self.CSV_FILE_NAME}"'},
            )

        return router

    @staticmethod
    def _profile_of(workspace: Workspace, body: ProfileBody) -> ModelProfile:
        if body.key is None:
            raise KeyError("No model given.")
        return workspace.library.profile_of_key(body.key)
