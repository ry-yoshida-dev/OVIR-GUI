from pydantic import BaseModel


class ClassRowBody(BaseModel):
    """
    Class, or phrases of a class, typed by the user.

    Attributes
    ----------
    text : str
        ``name`` or ``name: phrase, phrase`` for a class, comma-separated phrases otherwise.
    class_index : int | None
        Class receiving the phrases; ``None`` adds a class.
    position : int
        Position of the new class or of the first new phrase.
    """

    text: str
    class_index: int | None
    position: int
