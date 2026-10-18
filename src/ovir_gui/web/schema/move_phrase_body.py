from pydantic import BaseModel


class MovePhraseBody(BaseModel):
    """
    Phrase moved to another position or class.

    Attributes
    ----------
    class_index : int
        Class of the phrase.
    phrase_index : int
        Position of the phrase.
    target_class_index : int | None
        Class to move to; ``None`` makes the phrase a class of its own.
    position : int
        Position in the target.
    """

    class_index: int
    phrase_index: int
    target_class_index: int | None
    position: int
