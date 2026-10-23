from collections.abc import Callable
from dataclasses import dataclass

from ...media import FrameKey
from ...models import ModelProfile
from ...prompting import PromptChange
from ...recognition import RecognitionTask
from ...results import ResultCatalog
from ...review import ReviewFilter
from ...workspace import Workspace


@dataclass(frozen=True)
class FrameViewContext:
    """
    What the findings of every picture shown in one request are read with, gathered from the workspace once.

    Attributes
    ----------
    task : RecognitionTask
        Current task.
    review_filter : ReviewFilter
        Minimums, acceptance and duplicate suppression deciding which findings pass.
    shown_catalog : ResultCatalog | None
        Results of the shown profile, ``None`` while none is shown.
    compared_catalog : ResultCatalog | None
        Results of the compared profile, ``None`` while none is compared.
    compared_profile : ModelProfile | None
        Profile compared with the shown one.
    change_of : Callable[[FrameKey], PromptChange | None]
        How the classes changed since a picture was recognized with the shown profile.
    """

    task: RecognitionTask
    review_filter: ReviewFilter
    shown_catalog: ResultCatalog | None
    compared_catalog: ResultCatalog | None
    compared_profile: ModelProfile | None
    change_of: Callable[[FrameKey], PromptChange | None]

    @classmethod
    def of(cls, workspace: Workspace) -> "FrameViewContext":
        """
        Context of the current state of a workspace.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.

        Returns
        -------
        FrameViewContext
            Catalogs, review filter and prompt changes as they are now.
        """
        return cls(
            task=workspace.task,
            review_filter=workspace.review.review_filter,
            shown_catalog=workspace.read_model.shown_catalog(),
            compared_catalog=workspace.read_model.compared_catalog(),
            compared_profile=workspace.compared_profile,
            change_of=workspace.read_model.change_check(),
        )
