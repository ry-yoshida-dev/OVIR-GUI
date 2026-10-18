from pydantic import BaseModel


class FindingReference(BaseModel):
    """
    One finding of the shown results.

    Attributes
    ----------
    path : str
        Media file.
    frame : int | None
        Frame of a video; ``None`` for an image.
    index : int
        Finding of the picture's result.
    """

    path: str
    frame: int | None
    index: int
