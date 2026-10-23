from dataclasses import dataclass


@dataclass(frozen=True)
class CountedNoun:
    """
    Noun written in the singular or the plural after a count, e.g. ``"1 image"`` and ``"3 images"``.

    Attributes
    ----------
    singular : str
        Form for a count of one.
    plural : str
        Form for any other count; the singular with ``s`` appended when empty.
    """

    singular: str
    plural: str = ""

    def form_for(self, count: int) -> str:
        """
        Noun alone in the form fitting a count.

        Parameters
        ----------
        count : int
            Number of things.

        Returns
        -------
        str
            The singular for one, the plural otherwise.
        """
        if count == 1:
            return self.singular
        return self.plural or f"{self.singular}s"

    def of(self, count: int) -> str:
        """
        Count followed by the noun.

        Parameters
        ----------
        count : int
            Number of things.

        Returns
        -------
        str
            E.g. ``"2 classes"``.
        """
        return f"{count} {self.form_for(count)}"
