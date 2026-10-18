from pydantic import BaseModel


class ShowBody(BaseModel):
    """
    Picture to show.

    Attributes
    ----------
    path : str
        Open image or video.
    frame : int | None
        Frame of a video; ``None`` keeps the shown frame or shows the first.
    """

    path: str
    frame: int | None = None
