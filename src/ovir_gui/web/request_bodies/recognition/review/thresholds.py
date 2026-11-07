from pydantic import BaseModel


class ThresholdsBody(BaseModel):
    """
    Minimum confidence of the classes and prompts for the current task.

    Attributes
    ----------
    default_minimum : float
        Minimum of every class without its own.
    class_minimums : dict[str, float]
        Own minimum of some classes.
    prompt_minimums : dict[str, dict[str, float]]
        Own minimum of some prompts, by class name and prompt.
    """

    default_minimum: float
    class_minimums: dict[str, float]
    prompt_minimums: dict[str, dict[str, float]] = {}
