from pydantic import BaseModel


class ApprovalBody(BaseModel):
    """
    Request that may need the user's approval to leave out classes.

    Attributes
    ----------
    is_skipping_approved : bool
        Whether the user approved leaving out classes the model cannot query.
    """

    is_skipping_approved: bool = False
