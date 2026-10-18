from enum import Enum


class RecognitionTask(Enum):
    """
    What a model recognizes in an image.

    Attributes
    ----------
    CLASSIFICATION : str
        Scores every class for the whole image.
    DETECTION : str
        Finds instances of the classes as boxes.
    SEGMENTATION : str
        Finds instances of the classes as masks with their boxes.
    """

    CLASSIFICATION = "classification"
    DETECTION = "detection"
    SEGMENTATION = "segmentation"

    @property
    def title(self) -> str:
        """
        Name shown to the user.

        Returns
        -------
        str
            E.g. ``"Detection"``.
        """
        match self:
            case RecognitionTask.CLASSIFICATION:
                return "Classification"
            case RecognitionTask.DETECTION:
                return "Detection"
            case RecognitionTask.SEGMENTATION:
                return "Segmentation"

    @property
    def is_instance_based(self) -> bool:
        """
        Whether results are instances located in the image.

        Returns
        -------
        bool
            True for detection and segmentation.
        """
        match self:
            case RecognitionTask.CLASSIFICATION:
                return False
            case RecognitionTask.DETECTION | RecognitionTask.SEGMENTATION:
                return True

    @property
    def is_mask_based(self) -> bool:
        """
        Whether every instance carries a mask.

        Returns
        -------
        bool
            True for segmentation.
        """
        return self is RecognitionTask.SEGMENTATION

    @property
    def finding_noun(self) -> str:
        """
        What one finding of the task is called.

        Returns
        -------
        str
            ``"prediction"``, ``"detection"`` or ``"instance"``.
        """
        match self:
            case RecognitionTask.CLASSIFICATION:
                return "prediction"
            case RecognitionTask.DETECTION:
                return "detection"
            case RecognitionTask.SEGMENTATION:
                return "instance"
