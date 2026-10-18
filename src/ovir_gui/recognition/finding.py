from dataclasses import dataclass

from .pixel_box import PixelBox


@dataclass(frozen=True)
class Finding:
    """
    One reviewable answer of a result, listed as one row: the predicted class of a classified image or one detected
    or segmented instance.

    Attributes
    ----------
    index : int
        Position of the finding in its result.
    class_name : str
        Class it reports.
    query_label : str
        Query that matched: a phrase or a reference image name.
    confidence : float
        Score or confidence in ``[0, 1]``.
    box : PixelBox | None
        Bounding box; ``None`` for a classification.
    area : float | None
        Pixel count of a mask or area of a box; ``None`` for a classification.
    """

    index: int
    class_name: str
    query_label: str
    confidence: float
    box: PixelBox | None
    area: float | None
