from dataclasses import dataclass

from .instance_mask import InstanceMask
from .pixel_box import PixelBox


@dataclass(frozen=True, eq=False)
class RecognizedInstance:
    """
    One object a detector or segmenter found.

    Attributes
    ----------
    class_name : str
        Class of the prompt the instance belongs to.
    matched_prompt : str
        Prompt that matched: a phrase, a reference image name or ``PromptClass.EXEMPLAR_LABEL``.
    confidence : float
        Confidence in ``[0, 1]``.
    box : PixelBox
        Bounding box in pixels.
    mask : InstanceMask | None
        Pixels of the instance; ``None`` for detections.
    """

    class_name: str
    matched_prompt: str
    confidence: float
    box: PixelBox
    mask: InstanceMask | None = None

    @property
    def area(self) -> float:
        """
        Size of the instance.

        Returns
        -------
        float
            Pixel count of the mask, or the box area without a mask.
        """
        return float(self.mask.area) if self.mask is not None else self.box.area
