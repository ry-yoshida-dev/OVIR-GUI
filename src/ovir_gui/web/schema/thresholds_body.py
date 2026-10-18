from pydantic import BaseModel


class ThresholdsBody(BaseModel):
    """
    Minimum confidence of the classes for the current task.

    Attributes
    ----------
    default_minimum : float
        Minimum of every class without its own.
    class_minimums : dict[str, float]
        Own minimum of some classes.
    """

    default_minimum: float
    class_minimums: dict[str, float]
