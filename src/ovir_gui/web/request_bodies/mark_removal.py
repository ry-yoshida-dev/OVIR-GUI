from pydantic import BaseModel


class MarkRemovalBody(BaseModel):
    """
    Object to unmark, on one picture or on every frame of its media file.

    Attributes
    ----------
    path : str
        Open image or video.
    frame : int | None
        Frame of a video whose mark is removed; ``None`` removes the object from every frame.
    object_id : int
        Object to unmark.
    """

    path: str
    frame: int | None = None
    object_id: int
