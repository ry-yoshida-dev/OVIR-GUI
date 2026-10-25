import math
from dataclasses import dataclass
from typing import ClassVar

from ..recognition import PixelBox
from .crop_image_format import CropImageFormat


@dataclass(frozen=True)
class CropOptions:
    """
    How instances are cropped out of their pictures.

    Attributes
    ----------
    image_format : CropImageFormat
        File format of the crops.
    margin_percent : float
        Context added on every side, as a percentage of the box width (left and right) and height (top and bottom).

    Raises
    ------
    ValueError
        If the margin is outside ``[0, 100]``.
    """

    MAXIMUM_MARGIN_PERCENT: ClassVar[float] = 100.0

    image_format: CropImageFormat = CropImageFormat.JPEG
    margin_percent: float = 0.0

    def __post_init__(self) -> None:
        if not 0.0 <= self.margin_percent <= self.MAXIMUM_MARGIN_PERCENT:
            raise ValueError(
                f"margin_percent must be in [0, {self.MAXIMUM_MARGIN_PERCENT:g}]. got {self.margin_percent}"
            )

    def pixel_region(self, box: PixelBox, width: int, height: int) -> PixelBox | None:
        """
        Whole pixels cropped for a box.

        Parameters
        ----------
        box : PixelBox
            Box of the instance.
        width : int
            Width of the picture.
        height : int
            Height of the picture.

        Returns
        -------
        PixelBox | None
            Box widened by the margin, rounded outwards and clipped to the
            picture; ``None`` when no pixel is left.
        """
        horizontal_margin: float = box.width * self.margin_percent / 100.0
        vertical_margin: float = box.height * self.margin_percent / 100.0
        left: int = max(0, math.floor(box.left - horizontal_margin))
        top: int = max(0, math.floor(box.top - vertical_margin))
        right: int = min(width, math.ceil(box.right + horizontal_margin))
        bottom: int = min(height, math.ceil(box.bottom + vertical_margin))
        if right <= left or bottom <= top:
            return None
        return PixelBox(left=float(left), top=float(top), right=float(right), bottom=float(bottom))
