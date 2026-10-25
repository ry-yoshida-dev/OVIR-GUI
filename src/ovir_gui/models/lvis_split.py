from enum import Enum


class LvisSplit(Enum):
    """
    LVIS split a zero-shot box AP is reported on.

    Attributes
    ----------
    MINIVAL : str
        LVIS minival, the split most open-vocabulary detection papers report on.
    VALIDATION : str
        LVIS v1.0 val, which scores lower than minival.
    """

    MINIVAL = "minival"
    VALIDATION = "val"
