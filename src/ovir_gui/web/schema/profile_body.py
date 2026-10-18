from pydantic import BaseModel


class ProfileBody(BaseModel):
    """
    Stored model profile, or none.

    Attributes
    ----------
    key : str | None
        Key of the profile.
    """

    key: str | None
