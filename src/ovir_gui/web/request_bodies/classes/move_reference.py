from pydantic import BaseModel


class MoveReferenceBody(BaseModel):
    """
    Reference image moved to another class.

    Attributes
    ----------
    class_index : int
        Class of the reference image.
    name : str
        Name of the reference image.
    digest : str
        Pixel digest of the reference image.
    target_class_index : int
        Class to move to.
    """

    class_index: int
    name: str
    digest: str
    target_class_index: int
