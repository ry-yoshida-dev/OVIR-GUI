from pydantic import Field

from .approval_body import ApprovalBody


class RunAllBody(ApprovalBody):
    """
    Request to recognize every picture of the open media lacking an up-to-date result.

    Attributes
    ----------
    start_frame : int | None
        Frame of the shown video from which recognition starts, so results arrive ahead of playback; the earlier
        frames follow. From the shown frame when absent.
    """

    start_frame: int | None = Field(default=None, ge=0)
