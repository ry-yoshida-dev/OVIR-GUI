from dataclasses import dataclass

from open_vocabulary_classification import PromptAggregation

from ..recognition import RecognitionTask
from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision


@dataclass(frozen=True)
class ModelSelection:
    """
    Preset chosen in the model settings with the overrides of its values.

    Fields that do not apply to the task of the preset are ``None``: thresholds for classification, pooling for
    detection and segmentation, the box detector unless a segmenter masks the boxes of a detector.

    Attributes
    ----------
    task : RecognitionTask
        Task of the preset.
    backend : str
        Model family of the preset.
    preset_name : str
        Preset name within the backend.
    device : ComputeDevice
        Device to run on.
    precision : ComputePrecision
        Floating-point type to run in.
    confidence_threshold : float | None
        Minimum confidence of an instance, in ``[0, 1]``.
    nms_iou_threshold : float | None
        IoU threshold of class-wise non-maximum suppression in ``[0, 1]``; ``None`` disables it.
    image_pooling : str | None
        Pooling of the image embedding of a classifier.
    box_detector_label : str | None
        Detection preset ``"<backend>/<name>"`` finding the boxes a segmenter masks; ``None`` keeps the box detector
        of the segmentation preset.
    tiling_grid_size : int | None
        Tiles along each side a classifier also scores every picture on; ``None`` scores the whole picture only.
    text_templates : tuple[str, ...] | None
        Sentences with one ``{}`` every phrase of a classifier is filled into; ``("{}",)`` uses the phrase as it is
        and ``None`` keeps the templates of the preset.
    aggregation : PromptAggregation | None
        How the prompts and templates of every class of a classifier become its score; ``None`` keeps the preset's.
    batch_size : int | None
        Pictures per forward pass, a power of two; ``None`` keeps the preset's, and models running one picture at a
        time ignore it.

    Raises
    ------
    ValueError
        If a threshold is outside ``[0, 1]``, the tiling grid is smaller than 2, no text template is given or the
        batch size is not a positive power of two.
    """

    task: RecognitionTask
    backend: str
    preset_name: str
    device: ComputeDevice
    precision: ComputePrecision
    confidence_threshold: float | None = None
    nms_iou_threshold: float | None = None
    image_pooling: str | None = None
    box_detector_label: str | None = None
    tiling_grid_size: int | None = None
    text_templates: tuple[str, ...] | None = None
    aggregation: PromptAggregation | None = None
    batch_size: int | None = None

    def __post_init__(self) -> None:
        for name, value in (
            ("confidence_threshold", self.confidence_threshold),
            ("nms_iou_threshold", self.nms_iou_threshold),
        ):
            if value is not None and not 0.0 <= value <= 1.0:
                raise ValueError(f"{name} must be in [0, 1]. got {value}")
        if self.tiling_grid_size is not None and self.tiling_grid_size < 2:
            raise ValueError(f"tiling_grid_size must be at least 2. got {self.tiling_grid_size}")
        if self.text_templates is not None and not self.text_templates:
            raise ValueError("text_templates must hold at least one template; use ('{}',) for the phrase as it is.")
        if self.batch_size is not None and (self.batch_size < 1 or self.batch_size & (self.batch_size - 1)):
            raise ValueError(f"batch_size must be a positive power of two. got {self.batch_size}")
