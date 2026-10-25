from enum import Enum


class LabelMode(Enum):
    """
    How many classes one picture may be labelled with.

    Attributes
    ----------
    SINGLE_LABEL : str
        Only the best class, kept when it reaches its minimum.
    MULTI_LABEL : str
        Every class reaching its minimum, each decided on its own.
    """

    SINGLE_LABEL = "single_label"
    MULTI_LABEL = "multi_label"

    @property
    def title(self) -> str:
        """
        Name shown to the user.

        Returns
        -------
        str
            E.g. ``"Multi-label"``.
        """
        match self:
            case LabelMode.SINGLE_LABEL:
                return "Single label"
            case LabelMode.MULTI_LABEL:
                return "Multi-label"
