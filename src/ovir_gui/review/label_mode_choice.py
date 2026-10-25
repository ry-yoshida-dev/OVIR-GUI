from enum import Enum

from ..recognition import LabelMode


class LabelModeChoice(Enum):
    """
    Label mode the user chose for the review of classifications.

    Attributes
    ----------
    AUTOMATIC : str
        The mode the scores of each result are made for: multi-label for sigmoid scores, single-label for softmax
        scores.
    SINGLE_LABEL : str
        Every picture keeps at most its best class.
    MULTI_LABEL : str
        Every class reaching its minimum is kept.
    """

    AUTOMATIC = "automatic"
    SINGLE_LABEL = "single_label"
    MULTI_LABEL = "multi_label"

    def resolved(self, native_label_mode: LabelMode) -> LabelMode:
        """
        Label mode applied to one result.

        Parameters
        ----------
        native_label_mode : LabelMode
            Mode the scores of the result are made for.

        Returns
        -------
        LabelMode
            ``native_label_mode`` when automatic, the chosen mode otherwise.
        """
        match self:
            case LabelModeChoice.AUTOMATIC:
                return native_label_mode
            case LabelModeChoice.SINGLE_LABEL:
                return LabelMode.SINGLE_LABEL
            case LabelModeChoice.MULTI_LABEL:
                return LabelMode.MULTI_LABEL
