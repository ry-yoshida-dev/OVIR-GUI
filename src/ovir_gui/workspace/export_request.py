from collections.abc import Mapping
from dataclasses import dataclass

from ..export import ExportOptions
from ..media import FrameKey


@dataclass(frozen=True, eq=False)
class ExportRequest:
    """
    Export chosen by the user.

    Attributes
    ----------
    options : ExportOptions
        Format, destination and extras.
    listed_indices : Mapping[FrameKey, frozenset[int]] | None
        Findings the result table lists per picture, used when only listed findings are exported.
    is_label_confidence_shown : bool
        Whether drawn labels carry the confidence.
    """

    options: ExportOptions
    listed_indices: Mapping[FrameKey, frozenset[int]] | None = None
    is_label_confidence_shown: bool = True
