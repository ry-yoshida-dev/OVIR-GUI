from pydantic import BaseModel


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
    template_combination : str | None
        Value of how the sentences of a classifier phrase turn into its score; ``None`` keeps the model's.
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
    template_combination: str | None = None
    batch_size: int | None = None
