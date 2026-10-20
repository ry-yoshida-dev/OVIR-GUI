from pydantic import BaseModel


class MarkBody(BaseModel):
    """
    Points and box marking one object on a picture.

    Attributes
    ----------
    path : str
        Open image or video.
    frame : int | None
        Frame of a video; ``None`` for an image.
    object_id : int | None
        Object the mark belongs to; ``None`` marks a new object.
    class_name : str
        Class the object is reported under.
    positive_points : list[list[float]]
        ``[x, y]`` pixels on the object.
    negative_points : list[list[float]]
        ``[x, y]`` pixels off the object.
    box : list[float] | None
        ``[left, top, right, bottom]`` around the object, or ``None``.
    """

    path: str
    frame: int | None = None
    object_id: int | None = None
    class_name: str
    positive_points: list[list[float]] = []
    negative_points: list[list[float]] = []
    box: list[float] | None = None
