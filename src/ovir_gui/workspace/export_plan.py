from dataclasses import dataclass

from ..models import ModelProfile


@dataclass(frozen=True)
class ExportPlan:
    """
    What an export would write now.

    Attributes
    ----------
    profile : ModelProfile
        Profile whose results are exported.
    picture_count : int
        Pictures with a result of the profile.
    pending_count : int
        Expected pictures recognized first because they lack an up-to-date result.
    issue : str
        Why the export cannot start; empty when it can.
    """

    profile: ModelProfile
    picture_count: int
    pending_count: int
    issue: str
