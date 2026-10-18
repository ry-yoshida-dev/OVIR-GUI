from enum import Enum


class ExportScope(Enum):
    """
    Which kept findings are exported.

    Attributes
    ----------
    KEPT : str
        Every finding not rejected and not below the minimums.
    LISTED : str
        Only the kept findings the result table lists with its filters.
    """

    KEPT = "kept"
    LISTED = "listed"

    @property
    def label(self) -> str:
        """
        Name shown to the user.

        Returns
        -------
        str
            Short name.
        """
        match self:
            case ExportScope.KEPT:
                return "Every kept finding"
            case ExportScope.LISTED:
                return "Only listed findings"

    @property
    def description(self) -> str:
        """
        Explanation shown next to the choice.

        Returns
        -------
        str
            One sentence.
        """
        match self:
            case ExportScope.KEPT:
                return "Leaves out rejected findings and those below the class minimums."
            case ExportScope.LISTED:
                return "Also leaves out findings hidden by the filters of the result table."
