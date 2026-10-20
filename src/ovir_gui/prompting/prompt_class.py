from dataclasses import dataclass
from typing import ClassVar

from .visual_example import VisualExample


@dataclass(frozen=True)
class PromptClass:
    """
    One class of a prompt with every query it is asked with.

    Attributes
    ----------
    name : str
        Class name reported by the results.
    phrases : tuple[str, ...]
        Text queries in order.
    visual_examples : tuple[VisualExample, ...]
        Visual queries in order, one per reference image.
    is_exemplar_queried : bool
        Whether exemplar boxes drawn on the recognized pictures define the class; a class without phrases is then
        segmented from its positive boxes alone, on the pictures holding some.

    Raises
    ------
    ValueError
        If the class has no query.
    """

    EXEMPLAR_LABEL: ClassVar[str] = "exemplars"

    name: str
    phrases: tuple[str, ...]
    visual_examples: tuple[VisualExample, ...]
    is_exemplar_queried: bool = False

    def __post_init__(self) -> None:
        if not self.phrases and not self.visual_examples and not self.is_exemplar_queried:
            raise ValueError(f"'{self.name}' needs at least one query.")

    @property
    def is_exemplar_only(self) -> bool:
        """
        Whether the class is queried by exemplar boxes alone.

        Returns
        -------
        bool
            True without phrases and reference images.
        """
        return not self.phrases and not self.visual_examples

    @property
    def query_labels(self) -> tuple[str, ...]:
        """
        Labels of the queries in query order: phrases first, then reference images.

        Returns
        -------
        tuple[str, ...]
            One label per query; ``EXEMPLAR_LABEL`` alone for a class queried by exemplar boxes only.
        """
        if self.is_exemplar_only:
            return (self.EXEMPLAR_LABEL,)
        return (*self.phrases, *(example.label for example in self.visual_examples))
