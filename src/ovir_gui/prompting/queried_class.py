from dataclasses import dataclass, replace

from .exemplar_box import ExemplarBox
from .frame_prompt import FramePrompt
from .object_mark import ObjectMark
from .query_kind import QueryKind
from .reference_box import ReferenceBox


@dataclass(frozen=True)
class QueriedClass:
    """
    One class as a prompt queries it on one picture: its phrases, the reference boxes of its visual queries, and the
    exemplar boxes and object marks drawn for it.

    Two queried classes are equal when they query the same phrases, boxes and marks, regardless of order, so a result
    can tell whether the class it was recognized with has been edited since.

    Attributes
    ----------
    name : str
        Class name.
    phrases : frozenset[str]
        Phrases of its text queries; empty when the model does not take phrases.
    reference_boxes : frozenset[ReferenceBox]
        Boxes of its visual queries; empty when the model does not take image prompts.
    exemplar_boxes : frozenset[ExemplarBox]
        Exemplar boxes drawn on the picture; empty when the model does not take exemplars.
    object_marks : frozenset[ObjectMark]
        Objects marked on the picture, or on its whole video for a tracker; empty when the model takes no marks.
    """

    name: str
    phrases: frozenset[str]
    reference_boxes: frozenset[ReferenceBox]
    exemplar_boxes: frozenset[ExemplarBox] = frozenset()
    object_marks: frozenset[ObjectMark] = frozenset()

    @property
    def is_queryable(self) -> bool:
        """
        Whether the class has any query.

        Returns
        -------
        bool
            True with at least one phrase, reference box, positive exemplar box or object mark.
        """
        return bool(
            self.phrases
            or self.reference_boxes
            or self.object_marks
            or any(box.is_positive for box in self.exemplar_boxes)
        )

    def narrowed_to(self, supported_kinds: frozenset[QueryKind]) -> "QueriedClass":
        """
        Same class as a model accepting some query kinds reads it.

        Parameters
        ----------
        supported_kinds : frozenset[QueryKind]
            Query kinds the model accepts.

        Returns
        -------
        QueriedClass
            Copy without the queries of other kinds.
        """
        return replace(
            self,
            phrases=self.phrases if QueryKind.TEXT in supported_kinds else frozenset(),
            reference_boxes=self.reference_boxes if QueryKind.VISUAL in supported_kinds else frozenset(),
            exemplar_boxes=self.exemplar_boxes if QueryKind.EXEMPLAR in supported_kinds else frozenset(),
            object_marks=self.object_marks if QueryKind.MARK in supported_kinds else frozenset(),
        )

    def with_drawings(self, frame_prompt: FramePrompt) -> "QueriedClass":
        """
        Same class with the exemplar boxes and object marks drawn for it.

        Parameters
        ----------
        frame_prompt : FramePrompt
            Drawings of the recognized picture.

        Returns
        -------
        QueriedClass
            Copy holding the drawings of this class.
        """
        return replace(
            self,
            exemplar_boxes=frozenset(frame_prompt.exemplars_of(self.name)),
            object_marks=frozenset(frame_prompt.marks_of(self.name)),
        )
