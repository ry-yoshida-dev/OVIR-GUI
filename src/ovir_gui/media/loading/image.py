from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps


@dataclass(frozen=True, eq=False)
class LoadedImage:
    """
    Image read from disk, upright according to its EXIF orientation.

    Attributes
    ----------
    path : Path
        Source file.
    image : Image.Image
        RGB pixels given to the model.
    """

    path: Path
    image: Image.Image

    @classmethod
    def open(cls, path: Path) -> "LoadedImage":
        """
        Read an image file.

        Parameters
        ----------
        path : Path
            Image file.

        Returns
        -------
        LoadedImage
            Upright RGB image.
        """
        with Image.open(path) as source:
            upright: Image.Image = ImageOps.exif_transpose(source)
            rgb_image: Image.Image = upright.convert("RGB")
        return cls(path=path, image=rgb_image)
