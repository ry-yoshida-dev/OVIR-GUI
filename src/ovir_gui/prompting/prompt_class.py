from dataclasses import dataclass

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

    Raises
    ------
    ValueError
        If the class has no query.
    """

    name: str
    phrases: tuple[str, ...]
    visual_examples: tuple[VisualExample, ...]

    def __post_init__(self) -> None:
        if not self.phrases and not self.visual_examples:
            raise ValueError(f"'{self.name}' needs at least one query.")

    @property
    def query_labels(self) -> tuple[str, ...]:
        """
        Labels of the queries in query order: phrases first, then reference images.

        Returns
        -------
        tuple[str, ...]
            One label per query.
        """
        return (*self.phrases, *(example.label for example in self.visual_examples))
