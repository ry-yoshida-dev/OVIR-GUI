from enum import Enum


class PromptMode(Enum):
    """
    How a model is told what to recognize.

    Attributes
    ----------
    CLASSES : str
        Every class is queried by its phrases, reference images or exemplar boxes.
    MARKS : str
        Every object is marked on the picture by points and a box, and reported under the class of its mark.
    AUTOMATIC : str
        Nothing is asked; the model finds every region of the picture.
    """

    CLASSES = "classes"
    MARKS = "marks"
    AUTOMATIC = "automatic"

    @property
    def is_class_list_needed(self) -> bool:
        """
        Whether a run needs at least one class.

        Returns
        -------
        bool
            False only for automatic mask generation.
        """
        match self:
            case PromptMode.CLASSES | PromptMode.MARKS:
                return True
            case PromptMode.AUTOMATIC:
                return False
