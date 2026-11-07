from pydantic import BaseModel


class PathsBody(BaseModel):
    """
    Files or directories on the server.

    Attributes
    ----------
    paths : list[str]
        Paths on the server.
    """

    paths: list[str]
