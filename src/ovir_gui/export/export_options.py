from dataclasses import dataclass, field
from pathlib import Path

from .crop_options import CropOptions
from .export_format import ExportFormat


@dataclass(frozen=True)
class ExportOptions:
    """
    How and where results are written.

    Attributes
    ----------
    export_format : ExportFormat
        Output format.
    output_directory : Path
        Directory receiving the files.
    is_confidence_included : bool
        Whether confidences are written; ignored by formats without a confidence field.
    is_annotated_image_saved : bool
        Whether every exported picture is also saved with its findings drawn.
    is_annotated_video_saved : bool
        Whether every exported video is also saved with its findings drawn on every frame.
    crop_options : CropOptions
        Image format and margin of cropped objects; ignored by other formats.
    """

    export_format: ExportFormat
    output_directory: Path
    is_confidence_included: bool = True
    is_annotated_image_saved: bool = False
    is_annotated_video_saved: bool = False
    crop_options: CropOptions = field(default_factory=CropOptions)
