from dataclasses import dataclass


@dataclass(frozen=True)
class BoxCorners:
    """
    Box sent by the browser as ``[left, top, right, bottom]`` in pixels.

    Attributes
    ----------
    left : float
        First x value.
    top : float
        First y value.
    right : float
        Second x value.
    bottom : float
        Second y value.
    """

    left: float
    top: float
    right: float
    bottom: float

    @classmethod
    def of(cls, value: list[float]) -> "BoxCorners":
        """
        Box of a request value.

        Parameters
        ----------
        value : list[float]
            ``[left, top, right, bottom]``.

        Returns
        -------
        BoxCorners
            Box with the values in the order given.

        Raises
        ------
        ValueError
            If the value does not hold four numbers.
        """
        if len(value) != 4:
            raise ValueError(f"a box needs [left, top, right, bottom]. got {value}")
        return cls(left=value[0], top=value[1], right=value[2], bottom=value[3])

    @property
    def xyxy(self) -> tuple[float, float, float, float]:
        """
        Values in the order given.

        Returns
        -------
        tuple[float, float, float, float]
            ``(left, top, right, bottom)``.
        """
        return (self.left, self.top, self.right, self.bottom)

    def clamped(self, width: float, height: float) -> "BoxCorners":
        """
        Box with its corners ordered and kept inside a picture.

        Parameters
        ----------
        width : float
            Picture width.
        height : float
            Picture height.

        Returns
        -------
        BoxCorners
            Box whose left and top are the smaller values, all within ``[0, width]`` and ``[0, height]``.
        """
        return BoxCorners(
            left=max(0.0, min(self.left, self.right)),
            top=max(0.0, min(self.top, self.bottom)),
            right=min(width, max(self.left, self.right)),
            bottom=min(height, max(self.top, self.bottom)),
        )
