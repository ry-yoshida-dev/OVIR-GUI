from dataclasses import dataclass

from .exemplar_box import ExemplarBox
from .object_mark import ObjectMark


@dataclass(frozen=True)
class FramePrompt:
    """
    What is drawn on one picture, or on every frame of one video, besides the queries of the classes.

    Attributes
    ----------
    exemplars : tuple[ExemplarBox, ...]
        Exemplar boxes in drawing order.
    marks : tuple[ObjectMark, ...]
        Object marks ordered by frame and object.
    """

    exemplars: tuple[ExemplarBox, ...] = ()
    marks: tuple[ObjectMark, ...] = ()

    @property
    def is_empty(self) -> bool:
        """
        Whether nothing is drawn.

        Returns
        -------
        bool
            True without exemplars and marks.
        """
        return not self.exemplars and not self.marks

    @property
    def class_names(self) -> tuple[str, ...]:
        """
        Classes drawn on the picture.

        Returns
        -------
        tuple[str, ...]
            Classes of the exemplars, then of the marks, each once in order of appearance.
        """
        return tuple(
            dict.fromkeys([box.class_name for box in self.exemplars] + [mark.class_name for mark in self.marks])
        )

    def exemplars_of(self, class_name: str) -> tuple[ExemplarBox, ...]:
        """
        Exemplar boxes of one class.

        Parameters
        ----------
        class_name : str
            Class to look up.

        Returns
        -------
        tuple[ExemplarBox, ...]
            Boxes in drawing order.
        """
        return tuple(box for box in self.exemplars if box.class_name == class_name)

    def marks_of(self, class_name: str) -> tuple[ObjectMark, ...]:
        """
        Object marks of one class.

        Parameters
        ----------
        class_name : str
            Class to look up.

        Returns
        -------
        tuple[ObjectMark, ...]
            Marks in order.
        """
        return tuple(mark for mark in self.marks if mark.class_name == class_name)

    def has_positive_exemplar(self, class_name: str) -> bool:
        """
        Whether a class is shown by at least one positive exemplar box.

        Parameters
        ----------
        class_name : str
            Class to look up.

        Returns
        -------
        bool
            True when a positive box of the class is drawn.
        """
        return any(box.is_positive for box in self.exemplars_of(class_name))
