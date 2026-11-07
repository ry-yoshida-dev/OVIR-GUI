from pydantic import BaseModel


class PictureBody(BaseModel):
    """
    One image or video frame.

    Attributes
    ----------
    path : str
        Open image or video.
    frame : int | None
        Frame of a video; ``None`` for an image.
    """

    path: str
    frame: int | None = None
