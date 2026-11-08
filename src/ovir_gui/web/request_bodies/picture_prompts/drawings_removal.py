from pydantic import BaseModel


class DrawingsRemovalBody(BaseModel):
    """
    Several drawings of one picture removed in one edit, so a single undo brings them all back.

    Attributes
    ----------
    path : str
        Open image or video.
    frame : int | None
        Frame of a video; ``None`` for an image.
    exemplar_indices : list[int]
        Positions of the exemplar boxes among those of the picture.
    object_ids : list[int]
        Objects to unmark on the picture.
    """

    path: str
    frame: int | None = None
    exemplar_indices: list[int] = []
    object_ids: list[int] = []
