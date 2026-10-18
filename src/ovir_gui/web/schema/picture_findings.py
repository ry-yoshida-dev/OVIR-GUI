from pydantic import BaseModel


class PictureFindings(BaseModel):
    """
    Findings of one picture.

    Attributes
    ----------
    path : str
        Media file.
    frame : int | None
        Frame of a video; ``None`` for an image.
    indices : list[int]
        Findings of the picture's result.
    """

    path: str
    frame: int | None
    indices: list[int]
