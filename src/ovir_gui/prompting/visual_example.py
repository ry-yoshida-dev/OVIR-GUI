from dataclasses import dataclass, field

from PIL import Image

from .reference_image import ReferenceImage


@dataclass(frozen=True)
class VisualExample:
    """
    One visual query: the boxes drawn on one reference image for one class.

    Examples compare by image identity and boxes, not by pixels, so a model adapter can key cached query embeddings by
    the example and reuse them while the boxes are unchanged.

    Attributes
    ----------
    reference_image : ReferenceImage
        Identity of the image; its name labels the query.
    boxes : tuple[tuple[float, float, float, float], ...]
        Boxes ``(left, top, right, bottom)`` around the examples, in pixels of ``pixels``.
    pixels : Image.Image
        RGB pixels of the reference image.

    Raises
    ------
    ValueError
        If there is no box.
    """

    reference_image: ReferenceImage
    boxes: tuple[tuple[float, float, float, float], ...]
    pixels: Image.Image = field(compare=False, hash=False, repr=False)

    def __post_init__(self) -> None:
        if not self.boxes:
            raise ValueError("a visual example needs at least one box.")

    @property
    def label(self) -> str:
        """
        Label of the query.

        Returns
        -------
        str
            Name of the reference image.
        """
        return self.reference_image.name

    def crops(self) -> tuple[Image.Image, ...]:
        """
        Pixels inside each box, for models that embed whole images.

        Returns
        -------
        tuple[Image.Image, ...]
            One crop per box, at least one pixel wide and high.
        """
        width, height = self.pixels.size
        crops: list[Image.Image] = []
        for left, top, right, bottom in self.boxes:
            crop_left: int = min(max(0, int(left)), width - 1)
            crop_top: int = min(max(0, int(top)), height - 1)
            crop_right: int = max(crop_left + 1, min(width, round(right)))
            crop_bottom: int = max(crop_top + 1, min(height, round(bottom)))
            crops.append(self.pixels.crop((crop_left, crop_top, crop_right, crop_bottom)))
        return tuple(crops)
