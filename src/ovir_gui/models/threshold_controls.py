from dataclasses import dataclass


@dataclass(frozen=True)
class ThresholdControls:
    """
    Threshold settings a model reads, shown with its settings.

    Attributes
    ----------
    confidence_label : str | None
        Label of the confidence threshold the model applies itself, or ``None`` when the class minimums take over.
    is_nms_shown : bool
        Whether the model reads an NMS IoU threshold.
    is_minimum_confidence_shown : bool
        Whether findings carry a confidence the class minimums filter.
    """

    confidence_label: str | None
    is_nms_shown: bool
    is_minimum_confidence_shown: bool
