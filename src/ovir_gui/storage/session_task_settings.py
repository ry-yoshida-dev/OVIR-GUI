from dataclasses import dataclass

from ..media import InferenceMode


@dataclass(frozen=True)
class SessionTaskSettings:
    """
    Sampling and inference choices one task had, restored when the task is shown again.

    Attributes
    ----------
    frame_step : int | None
        Distance between sampled video frames; ``None`` when not remembered.
    inference_mode : InferenceMode | None
        Which pictures are inferred; ``None`` when not remembered.
    is_auto_inference : bool | None
        Whether pictures are inferred automatically while the user works; ``None`` when not remembered.
    """

    frame_step: int | None = None
    inference_mode: InferenceMode | None = None
    is_auto_inference: bool | None = None
