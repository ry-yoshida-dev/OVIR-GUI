from collections.abc import Mapping
from dataclasses import dataclass, field

from ..media import InferenceMode
from ..models import ModelSelection
from ..recognition import RecognitionTask
from .session_media import SessionMedia


@dataclass(frozen=True)
class Session:
    """
    What the user was working on, restored at the next start.

    Attributes
    ----------
    media : Mapping[RecognitionTask, SessionMedia]
        Open media and shown picture of each task.
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
    """

    media: Mapping[RecognitionTask, SessionMedia] = field(default_factory=dict[RecognitionTask, SessionMedia])
    task: RecognitionTask | None = None
    frame_step: int | None = None
    inference_mode: InferenceMode | None = None
    is_auto_inference: bool | None = None
    selections: Mapping[RecognitionTask, ModelSelection] = field(default_factory=dict[RecognitionTask, ModelSelection])
