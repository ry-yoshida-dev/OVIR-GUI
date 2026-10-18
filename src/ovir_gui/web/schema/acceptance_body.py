from pydantic import BaseModel

from .picture_findings import PictureFindings


class AcceptanceBody(BaseModel):
    """
    Findings of the shown results to keep or reject.

    Attributes
    ----------
    findings : list[PictureFindings]
        Findings per picture.
    is_accepted : bool
        True to keep them, False to reject them.
    """

    findings: list[PictureFindings]
    is_accepted: bool
