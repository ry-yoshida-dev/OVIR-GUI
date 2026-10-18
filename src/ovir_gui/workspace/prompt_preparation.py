from dataclasses import dataclass

from ..prompting import LabeledPrompt


@dataclass(frozen=True, eq=False)
class PromptPreparation:
    """
    Prompt built from the classes, or why none could be built.

    Attributes
    ----------
    prompt : LabeledPrompt | None
        Prompt to recognize with; ``None`` when it could not be built.
    issue : str
        Why no prompt could be built; empty otherwise.
    unapproved_class_names : tuple[str, ...]
        Classes queried only by reference images the model cannot take, waiting for the user to approve leaving them
        out.
    """

    prompt: LabeledPrompt | None
    issue: str = ""
    unapproved_class_names: tuple[str, ...] = ()
