from pydantic import BaseModel


class ProfilesBody(BaseModel):
    """
    Stored model profiles.

    Attributes
    ----------
    keys : list[str]
        Keys of the profiles.
    """

    keys: list[str]
