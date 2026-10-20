from enum import Enum


class PlaybackState(Enum):
    """
    Whether a video has a browser-playable copy.

    Attributes
    ----------
    NONE : str
        No copy; the browser plays the file itself.
    PREPARING : str
        A copy is being encoded.
    READY : str
        A copy is served in place of the file.
    FAILED : str
        Encoding the copy failed.
    """

    NONE = "none"
    PREPARING = "preparing"
    READY = "ready"
    FAILED = "failed"
