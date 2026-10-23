from enum import Enum


class InferenceMode(Enum):
    """
    Which pictures are inferred automatically while the user works, and what Infer covers.

    A picture is an image or one video frame; video frames are sampled every ``VideoSampling.frame_step``-th frame.

    Attributes
    ----------
    SHOWN : str
        The picture on screen: the image, or the sampled frame at or before the shown video frame.
    ALL : str
        Every picture of the open media, the shown media first from the shown frame on.
    """

    SHOWN = "shown"
    ALL = "all"

    @property
    def label(self) -> str:
        """
        Name shown to the user.

        Returns
        -------
        str
            E.g. ``"Current view"``.
        """
        match self:
            case InferenceMode.SHOWN:
                return "Current view"
            case InferenceMode.ALL:
                return "All files"

    @classmethod
    def parsed(cls, value: str) -> "InferenceMode | None":
        """
        Mode stored under a value.

        Parameters
        ----------
        value : str
            Stored value, e.g. ``"all"``.

        Returns
        -------
        InferenceMode | None
            ``None`` when no mode has the value.
        """
        return next((mode for mode in cls if mode.value == value), None)
