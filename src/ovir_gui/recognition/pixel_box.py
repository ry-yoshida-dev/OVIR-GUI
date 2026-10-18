from dataclasses import dataclass


@dataclass(frozen=True)
class PixelBox:
    """
    Axis-aligned box in pixels of the image it was found in.

    Attributes
    ----------
    left : float
        Left edge.
    top : float
        Top edge.
    right : float
        Right edge.
    bottom : float
        Bottom edge.

    Raises
    ------
    ValueError
        If the box is inverted.
    """

    left: float
    top: float
    right: float
    bottom: float

    def __post_init__(self) -> None:
        if self.right < self.left or self.bottom < self.top:
            raise ValueError(f"box must not be inverted. got {self.xyxy}")

    @classmethod
    def of(cls, corners: list[float] | tuple[float, ...]) -> "PixelBox":
        """
        Build a box from four corners.

        Parameters
        ----------
        corners : list[float] | tuple[float, ...]
            ``(left, top, right, bottom)``.

        Returns
        -------
        PixelBox
            Box with these corners.

        Raises
        ------
        ValueError
            If there are not exactly four corners or the box is inverted.
        """
        if len(corners) != 4:
            raise ValueError(f"a box needs 4 corners. got {list(corners)}")
        left, top, right, bottom = (float(corner) for corner in corners)
        return cls(left=left, top=top, right=right, bottom=bottom)

    @property
    def xyxy(self) -> tuple[float, float, float, float]:
        """
        Corners of the box.

        Returns
        -------
        tuple[float, float, float, float]
            ``(left, top, right, bottom)``.
        """
        return (self.left, self.top, self.right, self.bottom)

    @property
    def width(self) -> float:
        """
        Width of the box.

        Returns
        -------
        float
            ``right - left``.
        """
        return self.right - self.left

    @property
    def height(self) -> float:
        """
        Height of the box.

        Returns
        -------
        float
            ``bottom - top``.
        """
        return self.bottom - self.top

    @property
    def area(self) -> float:
        """
        Area of the box.

        Returns
        -------
        float
            Width times height.
        """
        return self.width * self.height

    def intersection_over_union(self, other: "PixelBox") -> float:
        """
        Overlap with another box.

        Parameters
        ----------
        other : PixelBox
            Box to compare with.

        Returns
        -------
        float
            Intersection area divided by union area in ``[0, 1]``; ``0`` when both boxes are empty.
        """
        intersection_width: float = max(0.0, min(self.right, other.right) - max(self.left, other.left))
        intersection_height: float = max(0.0, min(self.bottom, other.bottom) - max(self.top, other.top))
        intersection: float = intersection_width * intersection_height
        union: float = self.area + other.area - intersection
        return intersection / union if union > 0.0 else 0.0
