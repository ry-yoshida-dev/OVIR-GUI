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
    media : str
        Value of the exported media kind: images or videos.
    listed_findings : list[PictureFindings] | None
        Pictures the image table lists with their listed findings; required for images, ignored for videos.
    crop_image_format : str
        Value of the image format of cropped objects.
    crop_margin_percent : float
        Margin around cropped objects, as a percentage of the box.
    """

    export_format: str
    is_confidence_included: bool = True
    media: str
    listed_findings: list[PictureFindings] | None = None
    crop_image_format: str = "jpeg"
    crop_margin_percent: float = 0.0
