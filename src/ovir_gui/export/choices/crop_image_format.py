from enum import Enum
from pathlib import Path

from PIL import Image


class CropImageFormat(Enum):
    """
    Image file format cropped instances are saved in.

    Attributes
    ----------
    JPEG : str
        Lossy JPEG at quality 92, small files.
    PNG : str
        Lossless PNG, exact pixels.
    """

    JPEG = "jpeg"
    PNG = "png"

    @property
    def label(self) -> str:
        """
        Name shown to the user.

        Returns
        -------
        str
            E.g. ``"JPEG"``.
        """
        match self:
            case CropImageFormat.JPEG:
                return "JPEG"
            case CropImageFormat.PNG:
                return "PNG (lossless)"

    @property
    def suffix(self) -> str:
        """
        File name suffix of a crop.

        Returns
        -------
        str
            Suffix with its dot.
        """
        match self:
            case CropImageFormat.JPEG:
                return ".jpg"
            case CropImageFormat.PNG:
                return ".png"

    def save(self, picture: Image.Image, target: Path) -> None:
        """
        Save a crop.

        Parameters
        ----------
        picture : Image.Image
            RGB pixels of the crop.
        target : Path
            File to write.
        """
        match self:
            case CropImageFormat.JPEG:
                picture.save(target, format="JPEG", quality=92)
            case CropImageFormat.PNG:
                picture.save(target, format="PNG")
