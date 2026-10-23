from dataclasses import dataclass, field

from ..media import InferenceMode, VideoSampling
from ..models import ModelSelection
from ..recognition import RecognitionTask


@dataclass
class RecognitionSettings:
    """
    How the user chose to recognize: the task, the model of each task, the sampled video frames and which pictures are
    inferred automatically. Remembered in the session.

    Attributes
    ----------
    task : RecognitionTask
        Task chosen in the model settings.
    selections : dict[RecognitionTask, ModelSelection]
        Model chosen for each task the user visited.
    sampling : VideoSampling
        Sampled frames of videos.
    inference_mode : InferenceMode
        Which pictures are inferred, automatically and by Infer.
    is_auto_inference : bool
        Whether the pictures of the inference mode are inferred automatically while the user works.
    """

    task: RecognitionTask
    selections: dict[RecognitionTask, ModelSelection] = field(default_factory=dict[RecognitionTask, ModelSelection])
    sampling: VideoSampling = field(default_factory=VideoSampling)
    inference_mode: InferenceMode = InferenceMode.SHOWN
    is_auto_inference: bool = True
