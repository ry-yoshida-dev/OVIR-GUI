from dataclasses import dataclass

from ..models import ModelProfile


@dataclass(frozen=True)
class ProfileSummary:
    """
    Counts of the stored results of one profile over the open media.

    Attributes
    ----------
    profile : ModelProfile
        Model and options.
    media_count : int
        Open media with at least one recognized picture.
    frame_count : int
        Recognized pictures of the open media.
    outdated_count : int
        Recognized pictures whose classes have changed since.
    finding_count : int
        Findings of the recognized pictures.
    """

    profile: ModelProfile
    media_count: int
    frame_count: int
    outdated_count: int
    finding_count: int
