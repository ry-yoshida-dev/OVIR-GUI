from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ExportReport:
    """
    What an export wrote.

    Attributes
    ----------
    format_name : str
        Name of the format.
    output_directory : Path
        Directory written to.
    picture_count : int
        Exported pictures.
    finding_count : int
        Exported findings.
    written_paths : tuple[Path, ...]
        Every file written.
    annotated_count : int | None
        Pictures and videos saved with findings drawn; ``None`` when not asked for.
    """

    format_name: str
    output_directory: Path
    picture_count: int
    finding_count: int
    written_paths: tuple[Path, ...]
    annotated_count: int | None

    @property
    def file_count(self) -> int:
        """
        Number of written files.

        Returns
        -------
        int
            Length of ``written_paths``.
        """
        return len(self.written_paths)
