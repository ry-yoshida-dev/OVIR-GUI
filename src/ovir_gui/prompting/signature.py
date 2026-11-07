from dataclasses import dataclass

from .frame_prompt import FramePrompt
from .queried_class import QueriedClass
from .query_kind import QueryKind


@dataclass(frozen=True)
class PromptSignature:
    """
    What a prompt queries on one picture, class by class, independent of query order and of cached embeddings.

    Attributes
    ----------
    classes : tuple[QueriedClass, ...]
        Queried classes in class-id order.

    Raises
    ------
    ValueError
        If two classes share a name.
    """

    classes: tuple[QueriedClass, ...]

    def __post_init__(self) -> None:
        names: list[str] = [queried_class.name for queried_class in self.classes]
        if len(set(names)) != len(names):
            raise ValueError(f"class names must be unique. got {', '.join(names)}")

    def class_named(self, name: str) -> QueriedClass | None:
        """
        Look up one class.

        Parameters
        ----------
        name : str
            Class name.

        Returns
        -------
        QueriedClass | None
            ``None`` if the prompt does not query the class.
        """
        return next((queried_class for queried_class in self.classes if queried_class.name == name), None)

    def with_drawings(self, frame_prompt: FramePrompt) -> "PromptSignature":
        """
        Signature of the classes on a picture with the exemplar boxes and object marks drawn on it.

        Parameters
        ----------
        frame_prompt : FramePrompt
            Drawings the result of the picture depends on.

        Returns
        -------
        PromptSignature
            Every class holding its drawings; classes only drawn are appended in order of appearance.
        """
        known_names: frozenset[str] = frozenset(queried_class.name for queried_class in self.classes)
        drawn_only: tuple[QueriedClass, ...] = tuple(
            QueriedClass(name=name, phrases=frozenset(), reference_boxes=frozenset())
            for name in frame_prompt.class_names
            if name not in known_names
        )
        return PromptSignature(
            tuple(queried_class.with_drawings(frame_prompt) for queried_class in (*self.classes, *drawn_only))
        )

    def for_query_kinds(self, supported_kinds: frozenset[QueryKind]) -> "PromptSignature":
        """
        What a model accepting some query kinds would be queried with.

        Parameters
        ----------
        supported_kinds : frozenset[QueryKind]
            Query kinds the model accepts; queries of other kinds are dropped.

        Returns
        -------
        PromptSignature
            Signature without the queries the model cannot take and without classes left with no query.
        """
        narrowed: tuple[QueriedClass, ...] = tuple(
            queried_class.narrowed_to(supported_kinds) for queried_class in self.classes
        )
        return PromptSignature(tuple(queried_class for queried_class in narrowed if queried_class.is_queryable))
