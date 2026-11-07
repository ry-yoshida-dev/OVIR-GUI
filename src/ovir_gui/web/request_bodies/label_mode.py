from pydantic import BaseModel

from ...recognition import LabelMode


class LabelModeBody(BaseModel):
    """
    Label mode of the review of classifications.

    Attributes
    ----------
    label_mode : LabelMode
        Single- or multi-label.
    """

    label_mode: LabelMode
