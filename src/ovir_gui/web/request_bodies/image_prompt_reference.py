from pydantic import BaseModel


class ImagePromptReference(BaseModel):
    """
    One reference image of a class.

    Attributes
    ----------
    class_index : int
        Class id.
    name : str
        Name of the reference image.
    digest : str
        Pixel digest of the reference image.
    """

    class_index: int
    name: str
    digest: str
