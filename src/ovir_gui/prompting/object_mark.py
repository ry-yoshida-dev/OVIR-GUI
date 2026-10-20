from dataclasses import dataclass, replace

from ..media import FrameKey


@dataclass(frozen=True)
class ObjectMark:
    """
    Points and a box drawn on one picture, marking a single object of a class.

    Image segmenters segment the object on the picture it is marked on. Video trackers follow it through the video,
    identified by ``object_id``; marks of the same object on later frames correct it there.

    Attributes
    ----------
    frame_key : FrameKey
        Picture the mark is drawn on.
    object_id : int
        Non-negative identifier of the object within its media file.
    class_name : str
        Class the object is reported under.
    positive_points : tuple[tuple[float, float], ...]
        ``(x, y)`` pixels on the object.
    negative_points : tuple[tuple[float, float], ...]
        ``(x, y)`` pixels off the object, excluded from its mask.
    box : tuple[float, float, float, float] | None
        ``(left, top, right, bottom)`` around the object; ``None`` without a box.

    Raises
    ------
    ValueError
        If the identifier is negative, the class name is blank, nothing marks the object (no positive point and no
        box), or the box has no area.
    """

    frame_key: FrameKey
    object_id: int
    class_name: str
    positive_points: tuple[tuple[float, float], ...] = ()
    negative_points: tuple[tuple[float, float], ...] = ()
    box: tuple[float, float, float, float] | None = None

    def __post_init__(self) -> None:
        if self.object_id < 0:
            raise ValueError(f"object_id must not be negative. got {self.object_id}")
        if not self.class_name.strip():
            raise ValueError("class_name must not be blank.")
        if not self.positive_points and self.box is None:
            raise ValueError("an object mark needs a positive point or a box; negative points only exclude regions.")
        if self.box is not None and (self.box[2] <= self.box[0] or self.box[3] <= self.box[1]):
            raise ValueError(f"mark box must have a positive area. got {self.box}")

    @property
    def label(self) -> str:
        """
        Label of the object in results.

        Returns
        -------
        str
            E.g. ``"object 3"``.
        """
        return f"object {self.object_id}"

    def renamed(self, class_name: str) -> "ObjectMark":
        """
        Same mark assigned to another class name.

        Parameters
        ----------
        class_name : str
            New class name.

        Returns
        -------
        ObjectMark
            Copy with ``class_name`` replaced.
        """
        return replace(self, class_name=class_name)
