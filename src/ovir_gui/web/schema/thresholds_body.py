from pydantic import BaseModel


class ThresholdsBody(BaseModel):
    """
    Minimum confidence of the classes and phrases for the current task.

    Attributes
    ----------
    default_minimum : float
        Minimum of every class without its own.
    class_minimums : dict[str, float]
        Own minimum of some classes.
    phrase_minimums : dict[str, dict[str, float]]
        Own minimum of some phrases, by class name and phrase.
    """

    default_minimum: float
    class_minimums: dict[str, float]
    phrase_minimums: dict[str, dict[str, float]] = {}
