from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Query

from .embedding_policy import EmbeddingPolicy
from .json_value import JsonObject, JsonValue
from .web_context import WebContext


class EmbeddingRoutes:
    """
    Requests of the user interface shown inside another application: which parent pages it may talk to, and the
    documents of recognized objects it hands to them.
    """

    def __init__(self, context: WebContext, policy: EmbeddingPolicy) -> None:
        """
        Parameters
        ----------
        context : WebContext
            Shared workspace and helpers.
        policy : EmbeddingPolicy
            Origins allowed to embed the interface.
        """
        self._context: WebContext = context
        self._policy: EmbeddingPolicy = policy

    def router(self) -> APIRouter:
        """
        Routes of the embedding requests.

        Returns
        -------
        APIRouter
            Router under ``/api``.
        """
        router: APIRouter = APIRouter(prefix="/api")
        context: WebContext = self._context
        policy: EmbeddingPolicy = self._policy

        @router.get("/embedding")
        async def embedding() -> JsonObject:
            origins: list[JsonValue] = list(policy.parent_origins)
            return {"parent_origins": origins}

        @router.get("/results/document")
        async def result_document(path: Annotated[list[str] | None, Query()] = None) -> JsonObject:
            return context.documents.results(context.workspace, self._paths_of(path))

        return router

    @staticmethod
    def _paths_of(paths: list[str] | None) -> list[Path] | None:
        return None if paths is None else [Path(path) for path in paths]
