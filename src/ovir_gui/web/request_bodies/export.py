from pydantic import BaseModel

from .picture_findings import PictureFindings


class ExportBody(BaseModel):
    """
    Export chosen in the export dialog.

    Attributes
    ----------
    export_format : str
        Value of the export format.
    output_directory : str
        Directory on the server receiving the files.
    is_confidence_included : bool
        Whether confidences are written.
    media : str
        Value of the exported media kind: images or videos.
    is_annotated_image_saved : bool
        Whether pictures are also saved with their findings drawn.
    is_annotated_video_saved : bool
        Whether videos are also saved with their findings drawn on every frame.
    listed_findings : list[PictureFindings] | None
        Pictures the image table lists with their listed findings; required for images, ignored for videos.
    is_label_confidence_shown : bool
        Whether drawn labels carry the confidence.
    crop_image_format : str
        Value of the image format of cropped objects.
    crop_margin_percent : float
        Margin around cropped objects, as a percentage of the box.
    """

    export_format: str
    output_directory: str
    is_confidence_included: bool = True
    media: str
    is_annotated_image_saved: bool = False
    is_annotated_video_saved: bool = False
    listed_findings: list[PictureFindings] | None = None
    is_label_confidence_shown: bool = True
    crop_image_format: str = "jpeg"
    crop_margin_percent: float = 0.0
