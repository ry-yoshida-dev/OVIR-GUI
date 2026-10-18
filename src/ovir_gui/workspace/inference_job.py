from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

from ..media import FrameKey, MediaItem
from ..models import ModelProfile, RecognitionModel
from ..prompting import LabeledPrompt
from .job_control import JobControl
from .job_purpose import JobPurpose


@dataclass(frozen=True, eq=False)
class InferenceJob:
    """
    Pictures to recognize with one model and prompt.

    Attributes
    ----------
    purpose : JobPurpose
        Why the job runs.
    model : RecognitionModel
        Settings to recognize with.
    prompt : LabeledPrompt
        Classes and queries.
    frame_keys : tuple[FrameKey, ...]
        Pictures in the order they are recognized; ascending frames of one video are read in one pass.
    media : Mapping[Path, MediaItem]
        Media the pictures belong to.
    control : JobControl
        Stop requests and progress, shared with the worker.

    Raises
    ------
    ValueError
        If the job has no picture.
    """

    purpose: JobPurpose
    model: RecognitionModel
    prompt: LabeledPrompt
    frame_keys: tuple[FrameKey, ...]
    media: Mapping[Path, MediaItem]
    control: JobControl = field(default_factory=JobControl)

    def __post_init__(self) -> None:
        if not self.frame_keys:
            raise ValueError("a job needs at least one picture.")

    @property
    def profile(self) -> ModelProfile:
        """
        Profile of the results.

        Returns
        -------
        ModelProfile
            Profile of ``model``.
        """
        return self.model.profile()

    @property
    def remaining_keys(self) -> tuple[FrameKey, ...]:
        """
        Pictures the worker has not handed back yet.

        Returns
        -------
        tuple[FrameKey, ...]
            Tail of ``frame_keys``.
        """
        return self.frame_keys[self.control.processed_count :]
