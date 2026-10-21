from dataclasses import dataclass

from ..models import ModelProfile


@dataclass(frozen=True)
class ProfileSummary:
    """
    Progress and counts of the stored results of one profile over the open media.

    Attributes
    ----------
    profile : ModelProfile
        Model and options.
    file_count : int
        Open images and videos.
    done_file_count : int
        Open files whose every expected picture is recognized.
    expected_frame_count : int
        Pictures the open files are recognized on: one per image, the sampled frames per video.
    recognized_frame_count : int
        Expected pictures this profile has a result for.
    outdated_count : int
        Recognized pictures whose classes have changed since.
    finding_count : int
        Findings of the recognized pictures of the open media.
    """

    profile: ModelProfile
    file_count: int
    done_file_count: int
    expected_frame_count: int
    recognized_frame_count: int
    outdated_count: int
    finding_count: int
