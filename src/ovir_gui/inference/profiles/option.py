from dataclasses import dataclass


@dataclass(frozen=True)
class ProfileOption:
    """
    One setting telling results of the same model apart, e.g. ``Conf`` = ``0.35``.

    Attributes
    ----------
    name : str
        Short column name.
    value : str
        Value as shown.
    """

    name: str
    value: str
