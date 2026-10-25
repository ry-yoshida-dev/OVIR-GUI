from dataclasses import dataclass, field

from ..prompting import PicturePromptBoard, ReferenceBoard
from ..vocabulary import ClassVocabulary


@dataclass
class TaskClasses:
    """
    Classes of one task with their reference images, drawings and class set, edited through the ``ClassWorkbench``.

    Attributes
    ----------
    vocabulary : ClassVocabulary
        Classes in class-id order with their phrases.
    reference_board : ReferenceBoard
        Reference boxes of the classes.
    picture_board : PicturePromptBoard
        Exemplar boxes and object marks drawn on the pictures for the classes.
    class_set_name : str
        Saved class set the classes were last loaded from or saved to; empty for none.
    is_edited : bool
        Whether the classes changed since they were restored, loaded or saved.
    """

    vocabulary: ClassVocabulary = field(default_factory=ClassVocabulary)
    reference_board: ReferenceBoard = field(default_factory=ReferenceBoard)
    picture_board: PicturePromptBoard = field(default_factory=PicturePromptBoard)
    class_set_name: str = ""
    is_edited: bool = False
