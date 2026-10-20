from dataclasses import dataclass, replace

from ..media import FrameKey


@dataclass(frozen=True)
class ExemplarBox:
    """
    Box drawn on the picture being segmented, showing what a class is (positive) or is not (negative) there.

    SAM 3 segments every instance of the concept the boxes define on that picture, not only the boxed ones. A class
    without phrases is segmented from its positive boxes alone.

    Attributes
    ----------
    frame_key : FrameKey
        Picture the box is drawn on.
    class_name : str
        Class the box shows or excludes.
    left : float
        Left edge in image pixels.
    top : float
        Top edge in image pixels.
    right : float
        Right edge in image pixels.
    bottom : float
        Bottom edge in image pixels.
    is_positive : bool
        Whether the box shows an instance of the class rather than a look-alike to exclude.

    Raises
    ------
    ValueError
        If the class name is blank or the box has no area.
    """

    frame_key: FrameKey
    class_name: str
    left: float
    top: float
    right: float
    bottom: float
    is_positive: bool = True

    def __post_init__(self) -> None:
        if not self.class_name.strip():
            raise ValueError("class_name must not be blank.")
        if self.right <= self.left or self.bottom <= self.top:
            raise ValueError(f"exemplar box must have a positive area. got {self.xyxy}")

    @property
    def xyxy(self) -> tuple[float, float, float, float]:
        """
        Corners of the box.

        Returns
        -------
        tuple[float, float, float, float]
            ``(left, top, right, bottom)`` in image pixels.
        """
        return (self.left, self.top, self.right, self.bottom)

    def renamed(self, class_name: str) -> "ExemplarBox":
        """
        Same box assigned to another class name.

        Parameters
        ----------
        class_name : str
            New class name.

        Returns
        -------
        ExemplarBox
            Copy with ``class_name`` replaced.
        """
        return replace(self, class_name=class_name)
