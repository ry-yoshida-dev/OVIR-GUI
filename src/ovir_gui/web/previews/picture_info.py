from dataclasses import dataclass


@dataclass(frozen=True)
class PictureInfo:
    """
    Version and upright size of an image file, read without decoding its pixels.

    Attributes
    ----------
    version : str
        Modification time and size of the file, changing whenever the file changes.
    width : int
        Upright width in pixels.
    height : int
        Upright height in pixels.
    """

    version: str
    width: int
    height: int
