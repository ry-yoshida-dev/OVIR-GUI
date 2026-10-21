from pydantic import BaseModel


class InferenceBody(BaseModel):
    """
    Which pictures are inferred, and whether automatically.

    Attributes
    ----------
    mode : str
        Value of the inference mode.
    is_auto : bool
        Whether the pictures of the mode are inferred automatically while the user works.
    """

    mode: str
    is_auto: bool
