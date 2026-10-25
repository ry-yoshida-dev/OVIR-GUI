from pydantic import BaseModel


class TextTemplatesBody(BaseModel):
    """
    Text templates saved for reuse by classifiers.

    Attributes
    ----------
    templates : list[str]
        Templates in their order, each with exactly one ``{}``.
    """

    templates: list[str]
