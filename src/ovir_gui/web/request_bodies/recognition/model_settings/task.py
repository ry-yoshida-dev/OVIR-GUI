from pydantic import BaseModel


class TaskBody(BaseModel):
    """
    Task to switch to.

    Attributes
    ----------
    task : str
        Value of the recognition task.
    """

    task: str
