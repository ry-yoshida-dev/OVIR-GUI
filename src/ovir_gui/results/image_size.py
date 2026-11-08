from dataclasses import dataclass


@dataclass(frozen=True)
class ImageSize:
    """
    Pixel size of an image or a video frame.

    Attributes
    ----------
    width : int
        Width in pixels.
    height : int
        Height in pixels.

    Raises
    ------
    ValueError
        If a side is not positive.
    """

    width: int
    height: int

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError(f"width and height must be positive. got ({self.width}, {self.height})")

    @property
    def text(self) -> str:
        """
        Size written as ``WxH``.

        Returns
        -------
        str
            E.g. ``"1920x1080"``.
        """
        return f"{self.width}x{self.height}"
