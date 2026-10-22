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
    is_playing : bool
        Whether the video plays from the frame, so automatic inference recognizes the frames ahead of it first.
    """

    path: str
    frame: int | None = None
    is_playing: bool = False
