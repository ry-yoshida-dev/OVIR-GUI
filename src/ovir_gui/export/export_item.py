from dataclasses import dataclass

from ..media import FrameKey
from ..recognition import FrameResult


@dataclass(frozen=True, eq=False)
class ExportItem:
    """
    One picture as it is exported.

    Attributes
    ----------
    frame_key : FrameKey
        Image or video frame.
    result : FrameResult
        Result with only the exported instances; a classification keeps every class score.
    label : str | None
        Exported class of a classification; ``None`` when its top class is not kept, and for other tasks.
    seconds : float | None
        Time of a video frame from the start of its video.
    """

    frame_key: FrameKey
    result: FrameResult
    label: str | None
    seconds: float | None
