from pydantic import BaseModel


class NameBody(BaseModel):
    """
    A name.

    Attributes
    ----------
    name : str
        Name.
    """

    name: str
