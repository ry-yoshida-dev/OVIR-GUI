from dataclasses import dataclass

from PIL import Image

from .frame_key import FrameKey


@dataclass(frozen=True)
class LoadedPicture:
    """
    One picture read by ``PictureLoader``: its pixels, or the error that kept it from being read.

    Attributes
    ----------
    frame_key : FrameKey
        Image or video frame read.
    image_or_error : Image.Image | Exception
        RGB pixels, or the error raised while reading them.
    """

    frame_key: FrameKey
    image_or_error: Image.Image | Exception
