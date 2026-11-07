from pydantic import BaseModel


class LicenseBody(BaseModel):
    """
    Licensed module whose license the user accepted.

    Attributes
    ----------
    dependency : str
        Value of the licensed dependency.
    """

    dependency: str
