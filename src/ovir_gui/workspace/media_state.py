from enum import Enum


class MediaState(Enum):
    """
    How far an open image or video is recognized with the shown model.

    Attributes
    ----------
    NOT_ANALYZED : str
        No picture recognized.
    PARTIAL : str
        Some sampled frames of a video recognized.
    DONE : str
        Every expected picture recognized with the current classes.
    OUTDATED : str
        Some pictures were recognized with other classes.
    FAILED : str
        Recognition failed for some pictures.
    """

    NOT_ANALYZED = "not_analyzed"
    PARTIAL = "partial"
    DONE = "done"
    OUTDATED = "outdated"
    FAILED = "failed"

    @property
    def color(self) -> str:
        """
        Color of the status dot.

        Returns
        -------
        str
            ``#rrggbb``.
        """
        match self:
            case MediaState.NOT_ANALYZED:
                return "#9aa0a6"
            case MediaState.PARTIAL:
                return "#4363d8"
            case MediaState.DONE:
                return "#3cb44b"
            case MediaState.OUTDATED:
                return "#f58231"
            case MediaState.FAILED:
                return "#e6194b"
