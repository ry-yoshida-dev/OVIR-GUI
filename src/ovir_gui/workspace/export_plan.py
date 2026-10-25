from dataclasses import dataclass

from ..media import MediaKind
from ..models import ModelProfile


@dataclass(frozen=True)
class ExportPlan:
    """
    What an export of the images or the videos would write now.

    Attributes
    ----------
    profile : ModelProfile
        Profile whose results are exported.
    media_kind : MediaKind
        Whether the images or the videos are exported.
    picture_count : int
        Pictures of the media kind with a result of the profile.
    pending_count : int
        Expected pictures of the media kind without an up-to-date result, left out of the export.
    is_pending_inferable : bool
        Whether the chosen model can infer the pending pictures, because it has the settings of the profile.
    issue : str
        Why the export cannot start; empty when it can.
    """

    profile: ModelProfile
    media_kind: MediaKind
    picture_count: int
    pending_count: int
    is_pending_inferable: bool
    issue: str
