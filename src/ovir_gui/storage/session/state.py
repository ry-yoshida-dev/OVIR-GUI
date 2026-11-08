from collections.abc import Mapping
from dataclasses import dataclass, field

from ...inference import ModelSelection
from ...results import RecognitionTask
from .media import SessionMedia
from .task_settings import SessionTaskSettings


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
    task_settings : Mapping[RecognitionTask, SessionTaskSettings]
        Sampling and inference choices of each task.
    selections : Mapping[RecognitionTask, ModelSelection]
        Model chosen for each task.
    """

    media: Mapping[RecognitionTask, SessionMedia] = field(default_factory=dict[RecognitionTask, SessionMedia])
    task: RecognitionTask | None = None
    task_settings: Mapping[RecognitionTask, SessionTaskSettings] = field(
        default_factory=dict[RecognitionTask, SessionTaskSettings]
    )
    selections: Mapping[RecognitionTask, ModelSelection] = field(default_factory=dict[RecognitionTask, ModelSelection])
