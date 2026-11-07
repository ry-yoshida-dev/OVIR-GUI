from pydantic import BaseModel


class SamplingBody(BaseModel):
    """
    Sampling of video frames.

    Attributes
    ----------
    frame_step : int
        Distance between sampled frames.
    """

    frame_step: int
