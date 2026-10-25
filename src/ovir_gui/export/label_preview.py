from dataclasses import dataclass


@dataclass(frozen=True)
class LabelPreview:
    """
    Text of one label file an export writes, shown before exporting.

    Attributes
    ----------
    file_name : str
        Path of the file under the output directory; ``""`` when the format writes no text and the written files
        are listed instead, or when no picture is exported.
    text : str
        Contents of the file, JSON indented for reading; the written files one per line without a text file.
    is_shown_picture_only : bool
        Whether the file covers only the shown picture because the format writes one file per picture.
    is_truncated : bool
        Whether the text was cut to its first characters.
    """

    file_name: str
    text: str
    is_shown_picture_only: bool
    is_truncated: bool
