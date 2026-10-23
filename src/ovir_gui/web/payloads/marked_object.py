from dataclasses import dataclass, field


@dataclass
class MarkedObject:
    """
    One object marked on the frames of a media file, gathered from its marks.

    Attributes
    ----------
    class_name : str
        Class of the object, taken from its first mark.
    frame_indices : list[int | None]
        Frame of every mark of the object, in mark order; ``None`` for an image.
    """

    class_name: str
    frame_indices: list[int | None] = field(default_factory=list[int | None])
