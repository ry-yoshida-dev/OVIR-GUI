from dataclasses import dataclass

from .pixel_box import PixelBox


@dataclass(frozen=True)
class Finding:
    """
    One reviewable answer of a result, listed as one row: one class of a classified image or one detected or
    segmented instance.

    Attributes
    ----------
    index : int
        Position of the class score or the instance in its result.
    class_name : str
        Class it reports.
    matched_prompt : str
        Prompt that matched: a phrase, a reference image name or ``PromptClass.EXEMPLAR_LABEL``.
    confidence : float
        Score or confidence in ``[0, 1]``.
    box : PixelBox | None
        Bounding box; ``None`` for a classification.
    area : float | None
        Pixel count of a mask or area of a box; ``None`` for a classification.
    similarity : float | None
        Cosine similarity of the image and the matched prompt of a classification; ``None`` for an instance or a
        classification stored before it was recorded.
    matched_template : str | None
        Text template of the best sentence of a classification, ``"{}"`` for the phrase as written; ``None`` for an
        instance, a reference image or a classification stored before it was recorded.
    """

    index: int
    class_name: str
    matched_prompt: str
    confidence: float
    box: PixelBox | None
    area: float | None
    similarity: float | None
    matched_template: str | None
