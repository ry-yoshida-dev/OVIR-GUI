from pathlib import Path

from fastapi import APIRouter

from ..media import FrameKey
from ..prompting import ExemplarBox, ObjectMark
from ..workspace import Workspace
from .json_value import JsonObject
from .schema import ExemplarBody, ExemplarRemovalBody, MarkBody, MarkRemovalBody, PictureBody
from .web_context import WebContext


class PicturePromptRoutes:
    """
    Requests drawing exemplar boxes and object marks on the open pictures.
    """

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
        Routes of the drawing requests.

        Returns
        -------
        APIRouter
            Router under ``/api``.
        """
        router: APIRouter = APIRouter(prefix="/api")
        context: WebContext = self._context

        @router.post("/prompts/exemplars")
        async def add_exemplar(body: ExemplarBody) -> JsonObject:
            workspace: Workspace = context.workspace
            frame_key: FrameKey = self._frame_key_of(workspace, body.path, body.frame)
            self._require_class(workspace, body.class_name)
            left, top, right, bottom = self._box_of(body.box)
            box: ExemplarBox = ExemplarBox(
                frame_key=frame_key,
                class_name=body.class_name,
                left=left,
                top=top,
                right=right,
                bottom=bottom,
                is_positive=body.is_positive,
            )
            workspace.edit_picture_prompts(frame_key, lambda board: board.add_exemplar(box))
            return {}

        @router.post("/prompts/exemplars/remove")
        async def remove_exemplar(body: ExemplarRemovalBody) -> JsonObject:
            workspace: Workspace = context.workspace
            frame_key: FrameKey = self._frame_key_of(workspace, body.path, body.frame)
            workspace.edit_picture_prompts(frame_key, lambda board: board.remove_exemplar(frame_key, body.index))
            return {}

        @router.put("/prompts/marks")
        async def set_mark(body: MarkBody) -> JsonObject:
            workspace: Workspace = context.workspace
            frame_key: FrameKey = self._frame_key_of(workspace, body.path, body.frame)
            self._require_class(workspace, body.class_name)
            object_id: int = (
                workspace.workbench.picture_board.next_object_id(frame_key.path)
                if body.object_id is None
                else body.object_id
            )
            mark: ObjectMark = ObjectMark(
                frame_key=frame_key,
                object_id=object_id,
                class_name=body.class_name,
                positive_points=self._points_of(body.positive_points),
                negative_points=self._points_of(body.negative_points),
                box=None if body.box is None else self._box_of(body.box),
            )
            workspace.edit_picture_prompts(frame_key, lambda board: board.set_mark(mark))
            return {"object_id": object_id}

        @router.post("/prompts/marks/remove")
        async def remove_mark(body: MarkRemovalBody) -> JsonObject:
            workspace: Workspace = context.workspace
            path: Path = Path(body.path)
            if body.frame is None and workspace.media_item(path).is_video:
                workspace.edit_picture_prompts(
                    workspace.media_item(path).key_at(None), lambda board: board.remove_object(path, body.object_id)
                )
                return {}
            frame_key: FrameKey = self._frame_key_of(workspace, body.path, body.frame)
            workspace.edit_picture_prompts(frame_key, lambda board: board.remove_mark(frame_key, body.object_id))
            return {}

        @router.post("/prompts/clear")
        async def clear_picture(body: PictureBody) -> JsonObject:
            workspace: Workspace = context.workspace
            frame_key: FrameKey = self._frame_key_of(workspace, body.path, body.frame)
            workspace.edit_picture_prompts(frame_key, lambda board: board.clear_picture(frame_key))
            return {}

        return router

    @staticmethod
    def _frame_key_of(workspace: Workspace, path: str, frame: int | None) -> FrameKey:
        return workspace.media_item(Path(path)).key_at(frame)

    @staticmethod
    def _require_class(workspace: Workspace, class_name: str) -> None:
        if class_name not in workspace.workbench.class_names:
            raise KeyError(f"'{class_name}' is not a class. Add it to the classes first.")

    @staticmethod
    def _points_of(values: list[list[float]]) -> tuple[tuple[float, float], ...]:
        points: list[tuple[float, float]] = []
        for value in values:
            if len(value) != 2:
                raise ValueError(f"a point needs x and y. got {value}")
            points.append((value[0], value[1]))
        return tuple(points)

    @staticmethod
    def _box_of(value: list[float]) -> tuple[float, float, float, float]:
        if len(value) != 4:
            raise ValueError(f"a box needs [left, top, right, bottom]. got {value}")
        return (value[0], value[1], value[2], value[3])
