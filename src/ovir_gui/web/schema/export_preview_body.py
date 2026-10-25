from pydantic import BaseModel

from .picture_findings import PictureFindings


class ExportPreviewBody(BaseModel):
    """
    Export chosen in the export dialog, whose label file is previewed.

    Attributes
    ----------
    export_format : str
        Value of the export format.
    is_confidence_included : bool
        Whether confidences are written.
    scope : str
        Value of the export scope.
    minimum_confidence : float
        Findings below this confidence are left out.
    listed_findings : list[PictureFindings] | None
        Findings the result table lists, for previewing only those.
    crop_image_format : str
        Value of the image format of cropped objects.
    crop_margin_percent : float
        Margin around cropped objects, as a percentage of the box.
    """

    export_format: str
    is_confidence_included: bool = True
    scope: str = "kept"
    minimum_confidence: float = 0.0
    listed_findings: list[PictureFindings] | None = None
    crop_image_format: str = "jpeg"
    crop_margin_percent: float = 0.0
