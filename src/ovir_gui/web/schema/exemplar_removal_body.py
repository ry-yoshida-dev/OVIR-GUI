from pydantic import BaseModel


class ExemplarRemovalBody(BaseModel):
    """
    Exemplar box to remove from a picture.

    Attributes
    ----------
    path : str
        Open image or video.
    frame : int | None
        Frame of a video; ``None`` for an image.
    index : int
        Position of the box among the exemplar boxes of the picture.
    """

    path: str
    frame: int | None = None
    index: int
