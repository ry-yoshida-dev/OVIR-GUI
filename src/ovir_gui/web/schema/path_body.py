from pydantic import BaseModel


class PathBody(BaseModel):
    """
    A file or directory on the server.

    Attributes
    ----------
    path : str
        Path on the server.
    """

    path: str
