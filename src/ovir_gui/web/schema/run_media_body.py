from pydantic import Field

from .approval_body import ApprovalBody


class RunMediaBody(ApprovalBody):
    """
    Request to recognize the sampled frames of the shown video.

    Attributes
    ----------
    start_frame : int | None
        Frame from which recognition starts, so results arrive ahead of playback; the earlier frames follow. From the
        first frame when absent.
    """

    start_frame: int | None = Field(default=None, ge=0)
