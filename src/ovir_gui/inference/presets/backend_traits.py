from dataclasses import dataclass

from .segmentation_mode import SegmentationMode


@dataclass(frozen=True)
class BackendTraits:
    """
    Options a model family offers in the model settings.

    Attributes
    ----------
    image_poolings : tuple[str, ...]
        Image poolings of a classifier family, sorted; empty for the other tasks.
    is_box_prompted : bool
        Whether a segmenter family masks the boxes of a detector.
    segmentation_mode : SegmentationMode | None
        Interface of a segmentation family; ``None`` for the other tasks.
    """

    image_poolings: tuple[str, ...]
    is_box_prompted: bool
    segmentation_mode: SegmentationMode | None
