from dataclasses import dataclass
from typing import ClassVar

import cv2
import numpy as np

from .array_types import BoolArray, Int32Array, UInt8Array
from .pixel_box import PixelBox


@dataclass(frozen=True, eq=False)
class InstanceMask:
    """
    Pixels of one instance, kept compact: only its bounding box, one bit per pixel.

    A full-resolution boolean mask of a video frame takes megabytes; cropping to the instance and packing eight pixels
    per byte keeps hundreds of masked frames in memory and in the results archive.

    Attributes
    ----------
    left : int
        Column of the first pixel of the crop in the source image.
    top : int
        Row of the first pixel of the crop in the source image.
    width : int
        Columns of the crop.
    height : int
        Rows of the crop.
    packed_bits : UInt8Array
        ``np.packbits`` of the row-major crop.
    area : int
        Number of pixels of the instance.

    Raises
    ------
    ValueError
        If the crop is empty, the bits do not cover it, or the area does not fit the crop.
    """

    POLYGON_TOLERANCE_PIXELS: ClassVar[float] = 0.75

    left: int
    top: int
    width: int
    height: int
    packed_bits: UInt8Array
    area: int

    def __post_init__(self) -> None:
        if self.width <= 0 or self.height <= 0:
            raise ValueError(f"mask crop must not be empty. got {self.width}x{self.height}")
        expected_bytes: int = (self.width * self.height + 7) // 8
        if self.packed_bits.shape != (expected_bytes,):
            raise ValueError(f"packed_bits must hold {expected_bytes} bytes. got {self.packed_bits.shape}")
        if not 0 < self.area <= self.width * self.height:
            raise ValueError(f"area must be in (0, {self.width * self.height}]. got {self.area}")

    @classmethod
    def from_dense(cls, mask: BoolArray) -> "InstanceMask | None":
        """
        Compact a full-resolution mask.

        Parameters
        ----------
        mask : BoolArray
            Pixels of the instance in the source image, shape (H, W).

        Returns
        -------
        InstanceMask | None
            Crop of the mask to its bounding box; ``None`` when no pixel is set.
        """
        rows: np.ndarray = np.flatnonzero(mask.any(axis=1))
        columns: np.ndarray = np.flatnonzero(mask.any(axis=0))
        if rows.size == 0:
            return None
        top: int = int(rows[0])
        left: int = int(columns[0])
        crop: BoolArray = np.ascontiguousarray(mask[top : int(rows[-1]) + 1, left : int(columns[-1]) + 1])
        return cls(
            left=left,
            top=top,
            width=int(crop.shape[1]),
            height=int(crop.shape[0]),
            packed_bits=np.packbits(crop.reshape(-1)),
            area=int(crop.sum()),
        )

    @property
    def crop(self) -> BoolArray:
        """
        Pixels of the instance within its bounding box.

        Returns
        -------
        BoolArray
            Mask of shape (height, width).
        """
        bits: UInt8Array = np.unpackbits(self.packed_bits, count=self.width * self.height)
        return bits.astype(np.bool_).reshape(self.height, self.width)

    @property
    def box(self) -> PixelBox:
        """
        Bounding box of the pixels.

        Returns
        -------
        PixelBox
            Box with exclusive right and bottom edges.
        """
        return PixelBox(
            left=float(self.left),
            top=float(self.top),
            right=float(self.left + self.width),
            bottom=float(self.top + self.height),
        )

    def dense(self, width: int, height: int) -> BoolArray:
        """
        Full-resolution mask of the source image.

        Parameters
        ----------
        width : int
            Width of the source image.
        height : int
            Height of the source image.

        Returns
        -------
        BoolArray
            Mask of shape (height, width); parts of the crop outside the image are dropped.
        """
        dense_mask: BoolArray = np.zeros((height, width), dtype=np.bool_)
        bottom: int = min(height, self.top + self.height)
        right: int = min(width, self.left + self.width)
        if bottom > self.top and right > self.left:
            dense_mask[self.top : bottom, self.left : right] = self.crop[: bottom - self.top, : right - self.left]
        return dense_mask

    def intersection_over_union(self, other: "InstanceMask") -> float:
        """
        Pixel overlap with another mask of the same image.

        Parameters
        ----------
        other : InstanceMask
            Mask to compare with.

        Returns
        -------
        float
            Shared pixels divided by covered pixels in ``[0, 1]``.
        """
        left: int = max(self.left, other.left)
        top: int = max(self.top, other.top)
        right: int = min(self.left + self.width, other.left + other.width)
        bottom: int = min(self.top + self.height, other.top + other.height)
        intersection: int = 0
        if right > left and bottom > top:
            own: BoolArray = self.crop[top - self.top : bottom - self.top, left - self.left : right - self.left]
            theirs: BoolArray = other.crop[top - other.top : bottom - other.top, left - other.left : right - other.left]
            intersection = int(np.logical_and(own, theirs).sum())
        union: int = self.area + other.area - intersection
        return intersection / union if union > 0 else 0.0

    def polygons(self) -> list[list[tuple[float, float]]]:
        """
        Outer outline of every connected region, simplified to within a pixel.

        Returns
        -------
        list[list[tuple[float, float]]]
            Vertices ``(x, y)`` in pixels of the source image, one list per region with at least three vertices.
        """
        padded: UInt8Array = np.pad(self.crop.astype(np.uint8), 1)
        contours, _ = cv2.findContours(padded, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        polygons: list[list[tuple[float, float]]] = []
        for contour in contours:
            simplified: Int32Array = cv2.approxPolyDP(contour, self.POLYGON_TOLERANCE_PIXELS, True).astype(np.int32)
            points: Int32Array = simplified.reshape(-1, 2)
            if len(points) < 3:
                continue
            polygons.append([(float(x + self.left - 1), float(y + self.top - 1)) for x, y in points.tolist()])
        return polygons
