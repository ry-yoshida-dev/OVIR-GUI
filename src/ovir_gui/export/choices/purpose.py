from enum import Enum


class ExportPurpose(Enum):
    """
    What an export gives the user, offered as the first choice of the export dialog.

    Attributes
    ----------
    ANNOTATIONS : str
        Files listing the findings: tables and training formats.
    CROPS : str
        Every object saved as its own image.
    CLASS_FOLDERS : str
        Every classified picture copied into the folder of its class.
    """

    ANNOTATIONS = "annotations"
    CROPS = "crops"
    CLASS_FOLDERS = "class_folders"

    @property
    def label(self) -> str:
        """
        Name shown to the user.

        Returns
        -------
        str
            Short name.
        """
        match self:
            case ExportPurpose.ANNOTATIONS:
                return "Annotations"
            case ExportPurpose.CROPS:
                return "Crops"
            case ExportPurpose.CLASS_FOLDERS:
                return "Class folders"

    @property
    def description(self) -> str:
        """
        One line shown under the name.

        Returns
        -------
        str
            What the export writes.
        """
        match self:
            case ExportPurpose.ANNOTATIONS:
                return "Files listing every finding"
            case ExportPurpose.CROPS:
                return "Each object as its own image, in a folder per class"
            case ExportPurpose.CLASS_FOLDERS:
                return "Each picture copied into the folder of its class"
