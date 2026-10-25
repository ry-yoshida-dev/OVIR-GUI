from typing import ClassVar

from ..media import InferenceMode, VideoSampling
from ..models import ModelSelection
from ..recognition import RecognitionTask


class RecognitionSettings:
    """
    How the user chose to recognize: the task, and for each task its model, the sampled video frames and which
    pictures are inferred automatically. Remembered in the session.

    The sampling and inference choices read and written through the properties are those of the current task; a task
    the user has not changed keeps the defaults.

    Attributes
    ----------
    task : RecognitionTask
        Task chosen in the model settings.
    selections : dict[RecognitionTask, ModelSelection]
        Model chosen for each task the user visited.
    samplings : dict[RecognitionTask, VideoSampling]
        Sampled frames of videos for each task the user changed them in.
    inference_modes : dict[RecognitionTask, InferenceMode]
        Inferred pictures for each task the user changed them in.
    is_auto_inference_by_task : dict[RecognitionTask, bool]
        Automatic inference for each task the user changed it in.
    """

    DEFAULT_INFERENCE_MODE: ClassVar[InferenceMode] = InferenceMode.SHOWN
    IS_AUTO_INFERENCE_DEFAULT: ClassVar[bool] = True

    def __init__(self, task: RecognitionTask) -> None:
        """
        Parameters
        ----------
        task : RecognitionTask
            Task shown first.
        """
        self.task: RecognitionTask = task
        self.selections: dict[RecognitionTask, ModelSelection] = {}
        self.samplings: dict[RecognitionTask, VideoSampling] = {}
        self.inference_modes: dict[RecognitionTask, InferenceMode] = {}
        self.is_auto_inference_by_task: dict[RecognitionTask, bool] = {}

    @property
    def sampling(self) -> VideoSampling:
        """
        Sampled frames of videos in the current task.

        Returns
        -------
        VideoSampling
            Sampling of the task, every frame by default.
        """
        return self.samplings.get(self.task, VideoSampling())

    @sampling.setter
    def sampling(self, sampling: VideoSampling) -> None:
        self.samplings[self.task] = sampling

    @property
    def inference_mode(self) -> InferenceMode:
        """
        Which pictures of the current task are inferred, automatically and by Infer.

        Returns
        -------
        InferenceMode
            Mode of the task, the shown picture by default.
        """
        return self.inference_modes.get(self.task, self.DEFAULT_INFERENCE_MODE)

    @inference_mode.setter
    def inference_mode(self, mode: InferenceMode) -> None:
        self.inference_modes[self.task] = mode

    @property
    def is_auto_inference(self) -> bool:
        """
        Whether the pictures of the inference mode of the current task are inferred automatically while the user
        works.

        Returns
        -------
        bool
            Choice of the task, on by default.
        """
        return self.is_auto_inference_by_task.get(self.task, self.IS_AUTO_INFERENCE_DEFAULT)

    @is_auto_inference.setter
    def is_auto_inference(self, is_auto: bool) -> None:
        self.is_auto_inference_by_task[self.task] = is_auto
