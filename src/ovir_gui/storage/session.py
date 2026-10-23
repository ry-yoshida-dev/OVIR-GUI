from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path

from ..media import InferenceMode
from ..models import ModelSelection
from ..recognition import RecognitionTask


@dataclass(frozen=True)
class Session:
    """
    What the user was working on, restored at the next start.

    Attributes
    ----------
    media_paths : tuple[Path, ...]
        Open image and video files in list order.
    current_path : Path | None
        Shown file; ``None`` when nothing is shown.
    current_frame_index : int | None
        Shown frame of a video.
    task : RecognitionTask | None
        Task chosen in the model settings.
    frame_step : int | None
        Distance between sampled video frames.
    inference_mode : InferenceMode | None
        Which pictures are inferred.
    is_auto_inference : bool | None
        Whether pictures are inferred automatically while the user works.
    selections : Mapping[RecognitionTask, ModelSelection]
        Model chosen for each task.

    Raises
    ------
    ValueError
        If ``current_path`` is not one of ``media_paths``.
    """

    media_paths: tuple[Path, ...] = ()
    current_path: Path | None = None
    current_frame_index: int | None = None
    task: RecognitionTask | None = None
    frame_step: int | None = None
    inference_mode: InferenceMode | None = None
    is_auto_inference: bool | None = None
    selections: Mapping[RecognitionTask, ModelSelection] = field(default_factory=dict[RecognitionTask, ModelSelection])

    def __post_init__(self) -> None:
        if self.current_path is not None and self.current_path not in self.media_paths:
            raise ValueError(f"current_path must be one of media_paths. got {self.current_path}")
