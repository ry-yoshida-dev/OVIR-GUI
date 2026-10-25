from collections.abc import Mapping
from dataclasses import dataclass

from ..export import ExportOptions
from ..media import FrameKey, MediaKind


@dataclass(frozen=True, eq=False)
class ExportRequest:
    """
    Export chosen by the user.

    Attributes
    ----------
    options : ExportOptions
        Format, destination and extras.
    media_kind : MediaKind
        Whether the images or the videos are exported.
    listed_indices : Mapping[FrameKey, frozenset[int]] | None
        Pictures the image table lists with the findings it lists on each; ``None`` for videos, which export every
        kept finding.
    is_label_confidence_shown : bool
        Whether drawn labels carry the confidence.

    Raises
    ------
    ValueError
        If images are exported without the pictures the table lists.
    """

    options: ExportOptions
    media_kind: MediaKind
    listed_indices: Mapping[FrameKey, frozenset[int]] | None = None
    is_label_confidence_shown: bool = True

    def __post_init__(self) -> None:
        if self.media_kind is MediaKind.IMAGE and self.listed_indices is None:
            raise ValueError("An image export needs the pictures the image table lists.")
