from pydantic import BaseModel


class TextBody(BaseModel):
    """
    A text.

    Attributes
    ----------
    text : str
        Text.
    """

    text: str
