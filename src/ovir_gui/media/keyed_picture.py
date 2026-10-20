from dataclasses import dataclass

from PIL import Image

from .frame_key import FrameKey


@dataclass(frozen=True, eq=False)
class KeyedPicture:
    """
    Pixels of one recognizable picture together with the key naming it.

    Attributes
    ----------
    frame_key : FrameKey
        Image file or video frame the pixels were read from.
    image : Image.Image
        Upright RGB pixels.
    """

    frame_key: FrameKey
    image: Image.Image
