from pydantic import BaseModel

from ...review import LabelModeChoice


class LabelModeBody(BaseModel):
    """
    Label mode of the review of classifications.

    Attributes
    ----------
    label_mode : LabelModeChoice
        Automatic, single- or multi-label.
    """

    label_mode: LabelModeChoice
