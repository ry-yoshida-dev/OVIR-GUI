from dataclasses import dataclass

from .prompt_class import PromptClass
from .prompt_signature import PromptSignature
from .query_kind import QueryKind


@dataclass(frozen=True, eq=False)
class LabeledPrompt:
    """
    Classes to recognize with their queries, independent of the model library, and the signature of what they query.

    Model adapters turn it into the prompt type of their library; queries keep the order of ``query_labels`` (every
    class in order, its phrases first, then its reference images), so a matched query index names its label.

    Attributes
    ----------
    classes : tuple[PromptClass, ...]
        Classes in class-id order.
    signature : PromptSignature
        What the classes query, telling later whether they have changed since.

    Raises
    ------
    ValueError
        If there is no class, or the signature does not query the classes of the prompt.
    """

    classes: tuple[PromptClass, ...]
    signature: PromptSignature

    def __post_init__(self) -> None:
        if not self.classes:
            raise ValueError("a prompt needs at least one class.")
        signature_names: tuple[str, ...] = tuple(queried_class.name for queried_class in self.signature.classes)
        if signature_names != self.class_names:
            raise ValueError(f"signature must query {self.class_names}. got {signature_names}")

    @property
    def class_names(self) -> tuple[str, ...]:
        """
        Class names in class-id order.

        Returns
        -------
        tuple[str, ...]
            Name of every class.
        """
        return tuple(prompt_class.name for prompt_class in self.classes)

    @property
    def query_labels(self) -> tuple[str, ...]:
        """
        Label of every query in query order.

        Returns
        -------
        tuple[str, ...]
            Phrases and reference image names.
        """
        return tuple(label for prompt_class in self.classes for label in prompt_class.query_labels)

    @property
    def kinds(self) -> frozenset[QueryKind]:
        """
        Kinds of the queries.

        Returns
        -------
        frozenset[QueryKind]
            ``TEXT`` with any phrase, ``VISUAL`` with any reference image.
        """
        kinds: set[QueryKind] = set()
        for prompt_class in self.classes:
            if prompt_class.phrases:
                kinds.add(QueryKind.TEXT)
            if prompt_class.visual_examples:
                kinds.add(QueryKind.VISUAL)
        return frozenset(kinds)

    @property
    def description(self) -> str:
        """
        Count of the queries by kind.

        Returns
        -------
        str
            E.g. ``"5 text + 2 image prompts"``.
        """
        text_count: int = sum(len(prompt_class.phrases) for prompt_class in self.classes)
        visual_count: int = sum(len(prompt_class.visual_examples) for prompt_class in self.classes)
        parts: list[str] = []
        if text_count:
            parts.append(f"{text_count} text")
        if visual_count:
            parts.append(f"{visual_count} image")
        return f"{' + '.join(parts)} prompt{'' if text_count + visual_count == 1 else 's'}"
