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
    scope : str
        Value of the export scope.
    minimum_confidence : float
        Findings below this confidence are left out.
    is_annotated_image_saved : bool
        Whether pictures are also saved with their findings drawn.
    is_annotated_video_saved : bool
        Whether videos are also saved with their findings drawn on every frame.
    listed_findings : list[PictureFindings] | None
        Findings the result table lists, for exporting only those.
    is_label_confidence_shown : bool
        Whether drawn labels carry the confidence.
    is_skipping_approved : bool
        Whether the user approved leaving out classes the model cannot query.
    """

    export_format: str
    output_directory: str
    is_confidence_included: bool = True
    scope: str = "kept"
    minimum_confidence: float = 0.0
    is_annotated_image_saved: bool = False
    is_annotated_video_saved: bool = False
    listed_findings: list[PictureFindings] | None = None
    is_label_confidence_shown: bool = True
    is_skipping_approved: bool = False
