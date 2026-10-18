from pydantic import BaseModel

from .image_prompt_reference import ImagePromptReference
from .phrase_reference import PhraseReference


class RemoveClassesBody(BaseModel):
    """
    Classes, phrases and reference images removed at once.

    Attributes
    ----------
    class_indices : list[int]
        Classes to remove.
    phrases : list[PhraseReference]
        Phrases to remove.
    references : list[ImagePromptReference]
        Reference images to remove.
    """

    class_indices: list[int]
    phrases: list[PhraseReference]
    references: list[ImagePromptReference]
