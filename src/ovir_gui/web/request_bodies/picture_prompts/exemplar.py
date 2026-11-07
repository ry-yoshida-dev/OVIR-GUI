from pydantic import BaseModel


class ExemplarBody(BaseModel):
    """
    Exemplar box drawn on a picture.

    Attributes
    ----------
    path : str
        Open image or video.
    frame : int | None
        Frame of a video; ``None`` for an image.
    class_name : str
        Class the box shows or excludes.
    box : list[float]
        Box ``[left, top, right, bottom]`` in image pixels.
    is_positive : bool
        Whether the box shows the class rather than a look-alike to exclude.
    """

    path: str
    frame: int | None = None
    class_name: str
    box: list[float]
    is_positive: bool = True
