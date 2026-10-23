from collections.abc import Iterable
from dataclasses import dataclass, field, replace

from ..media import FrameKey
from ..wording import CountedNoun
from .frame_prompt import FramePrompt
from .picture_prompts import PicturePrompts
from .prompt_class import PromptClass
from .prompt_signature import PromptSignature
from .query_kind import QueryKind


@dataclass(frozen=True, eq=False)
class LabeledPrompt:
    """
    What a run recognizes, independent of the model library: the classes with their queries, the exemplar boxes and
    object marks drawn on the pictures, and how to tell later whether a result is still current.

    Model adapters turn it into the prompt type of their library; class queries keep the order of ``query_labels``
    (every class in order, its phrases first, then its reference images), so a matched query index names its label.
    Models taking object marks ask for the marks of each picture instead, and automatic mask generation ignores the
    prompt.

    Attributes
    ----------
    classes : tuple[PromptClass, ...]
        Classes queried by phrases, reference images or exemplar boxes, in class-id order; empty for models taking
        object marks or nothing.
    class_signature : PromptSignature
        What every current class queries, with every query kind and without drawings.
    query_kinds : frozenset[QueryKind]
        Query kinds of the model, narrowing the signature of every result.
    picture_prompts : PicturePrompts
        Exemplar boxes and object marks of the media being recognized.
    is_sequential : bool
        Whether the model follows objects through a video, so each frame depends on the drawings of its whole file.
    """

    classes: tuple[PromptClass, ...]
    class_signature: PromptSignature
    query_kinds: frozenset[QueryKind]
    picture_prompts: PicturePrompts = field(default_factory=PicturePrompts)
    is_sequential: bool = False

    @property
    def class_names(self) -> tuple[str, ...]:
        """
        Names of the queried classes in class-id order.

        Returns
        -------
        tuple[str, ...]
            Name of every class.
        """
        return tuple(prompt_class.name for prompt_class in self.classes)

    @property
    def query_labels(self) -> tuple[str, ...]:
        """
        Label of every class query in query order.

        Returns
        -------
        tuple[str, ...]
            Phrases, reference image names and exemplar labels.
        """
        return tuple(label for prompt_class in self.classes for label in prompt_class.query_labels)

    @property
    def has_exemplars(self) -> bool:
        """
        Whether exemplar boxes take part in the run.

        Returns
        -------
        bool
            True when the model takes exemplars and some are drawn.
        """
        return QueryKind.EXEMPLAR in self.query_kinds and bool(self.picture_prompts.exemplars)

    @property
    def description(self) -> str:
        """
        Count of the queries by kind.

        Returns
        -------
        str
            E.g. ``"5 text + 2 image prompts"``, ``"3 object marks"`` or ``"automatic"``.
        """
        text_count: int = sum(len(prompt_class.phrases) for prompt_class in self.classes)
        visual_count: int = sum(len(prompt_class.visual_examples) for prompt_class in self.classes)
        exemplar_count: int = len(self.picture_prompts.exemplars) if QueryKind.EXEMPLAR in self.query_kinds else 0
        mark_count: int = len(self.picture_prompts.marks) if QueryKind.MARK in self.query_kinds else 0
        parts: list[str] = [
            f"{count} {noun}"
            for count, noun in (
                (text_count, "text"),
                (visual_count, "image"),
                (exemplar_count, "exemplar"),
            )
            if count
        ]
        descriptions: list[str] = []
        if parts:
            total: int = text_count + visual_count + exemplar_count
            descriptions.append(f"{' + '.join(parts)} {CountedNoun('prompt').form_for(total)}")
        if mark_count:
            descriptions.append(CountedNoun("object mark").of(mark_count))
        return " + ".join(descriptions) if descriptions else "automatic"

    def frame_prompt_of(self, frame_key: FrameKey) -> FramePrompt:
        """
        Drawings of one picture the model takes.

        Parameters
        ----------
        frame_key : FrameKey
            Recognized picture.

        Returns
        -------
        FramePrompt
            Its exemplar boxes and object marks, each kept only when the model takes it.
        """
        drawn: FramePrompt = self.picture_prompts.of(frame_key)
        return FramePrompt(
            exemplars=drawn.exemplars if QueryKind.EXEMPLAR in self.query_kinds else (),
            marks=drawn.marks if QueryKind.MARK in self.query_kinds else (),
        )

    def signature_of(self, frame_key: FrameKey) -> PromptSignature:
        """
        What the result of one picture is recognized with.

        Parameters
        ----------
        frame_key : FrameKey
            Recognized picture.

        Returns
        -------
        PromptSignature
            Classes with the drawings the picture depends on, narrowed to the query kinds of the model.
        """
        drawings: FramePrompt = self.picture_prompts.relevant_to(frame_key, self.is_sequential)
        return self.class_signature.with_drawings(drawings).for_query_kinds(self.query_kinds)

    def restricted_to(self, class_names: Iterable[str]) -> "LabeledPrompt":
        """
        Same prompt querying some of its classes only.

        Parameters
        ----------
        class_names : Iterable[str]
            Classes to keep.

        Returns
        -------
        LabeledPrompt
            Copy whose classes are those named, in class-id order.
        """
        kept: frozenset[str] = frozenset(class_names)
        return replace(self, classes=tuple(prompt_class for prompt_class in self.classes if prompt_class.name in kept))
