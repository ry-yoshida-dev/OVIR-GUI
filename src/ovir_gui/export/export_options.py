from dataclasses import dataclass, field
from pathlib import Path

from .crop_options import CropOptions
from .export_format import ExportFormat
from .export_scope import ExportScope


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
    scope : ExportScope
        Every kept finding, or only those the result table lists.
    minimum_confidence : float
        Findings below this confidence are left out, in ``[0, 1]``.
    is_annotated_image_saved : bool
        Whether every exported picture is also saved with its findings drawn.
    is_annotated_video_saved : bool
        Whether every exported video is also saved with its findings drawn on every frame.
    crop_options : CropOptions
        Image format and margin of cropped objects; ignored by other formats.

    Raises
    ------
    ValueError
        If the minimum confidence is outside ``[0, 1]``.
    """

    export_format: ExportFormat
    output_directory: Path
    is_confidence_included: bool = True
    scope: ExportScope = ExportScope.KEPT
    minimum_confidence: float = 0.0
    is_annotated_image_saved: bool = False
    is_annotated_video_saved: bool = False
    crop_options: CropOptions = field(default_factory=CropOptions)

    def __post_init__(self) -> None:
        if not 0.0 <= self.minimum_confidence <= 1.0:
            raise ValueError(f"minimum_confidence must be in [0, 1]. got {self.minimum_confidence}")
