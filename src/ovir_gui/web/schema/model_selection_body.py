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
    box_confidence_threshold : float | None
        Minimum confidence of a masked box; ``None`` takes the box detector's own.
    tiling_grid_size : int | None
        Tiles along each side a classifier also scores; ``None`` scores the whole picture only.
    """

    backend: str
    preset_name: str
    device: str
    precision: str
    confidence_threshold: float | None = None
    nms_iou_threshold: float | None = None
    image_pooling: str | None = None
    box_detector_label: str | None = None
    box_confidence_threshold: float | None = None
    tiling_grid_size: int | None = None
