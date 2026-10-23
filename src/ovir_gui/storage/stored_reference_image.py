from dataclasses import dataclass

from PIL import Image

from ..prompting import ReferenceImage


@dataclass(frozen=True, eq=False)
class StoredReferenceImage:
    """
    Reference image read back from a class set archive with its pixels.

    Attributes
    ----------
    reference_image : ReferenceImage
        Name and digest of the image.
    pixels : Image.Image
        RGB pixels matching the digest.
    """

    reference_image: ReferenceImage
    pixels: Image.Image
