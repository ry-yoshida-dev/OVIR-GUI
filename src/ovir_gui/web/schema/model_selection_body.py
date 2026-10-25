from pydantic import BaseModel

from .aggregation_step_body import AggregationStepBody


class ModelSelectionBody(BaseModel):
    """
    Preset of the current task and overrides chosen in the model settings.

    Attributes
    ----------
    backend : str
        Model family.
    preset_name : str
        Preset name.
    device : str
        Value of the device.
    precision : str
        Value of the precision.
    confidence_threshold : float | None
        Minimum confidence of an instance.
    nms_iou_threshold : float | None
        IoU threshold of non-maximum suppression; ``None`` disables it.
    image_pooling : str | None
        Pooling of a classifier.
    box_detector_label : str | None
        Detection preset finding the boxes a segmenter masks; ``None`` keeps the preset's own.
    tiling_grid_size : int | None
        Tiles along each side a classifier also scores; ``None`` scores the whole picture only.
    text_templates : list[str] | None
        Sentences every phrase of a classifier is filled into; ``None`` keeps the preset's own.
    aggregation : list[AggregationStepBody] | None
        Steps merging the prompts and templates of every class of a classifier, in order; ``None`` keeps the
        preset's own.
    batch_size : int | None
        Pictures per forward pass, a power of two; ``None`` keeps the preset's own.
    """

    backend: str
    preset_name: str
    device: str
    precision: str
    confidence_threshold: float | None = None
    nms_iou_threshold: float | None = None
    image_pooling: str | None = None
    box_detector_label: str | None = None
    tiling_grid_size: int | None = None
    text_templates: list[str] | None = None
    aggregation: list[AggregationStepBody] | None = None
    batch_size: int | None = None
