from pydantic import BaseModel


class BackgroundBody(BaseModel):
    """
    What is recognized in the background.

    Attributes
    ----------
    scope : str
        Value of the background scope.
    """

    scope: str
