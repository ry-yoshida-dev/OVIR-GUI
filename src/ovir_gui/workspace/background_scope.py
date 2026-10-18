from enum import Enum


class BackgroundScope(Enum):
    """
    Which pictures are recognized in the background while the user works.

    Attributes
    ----------
    OFF : str
        None; only what the user runs.
    SHOWN : str
        The shown image, or the sampled frames of the shown video from the shown frame on.
    ALL : str
        The shown media first, then every other open image and video.
    """

    OFF = "off"
    SHOWN = "shown"
    ALL = "all"

    @property
    def label(self) -> str:
        """
        Name shown to the user.

        Returns
        -------
        str
            E.g. ``"Shown media"``.
        """
        match self:
            case BackgroundScope.OFF:
                return "Off"
            case BackgroundScope.SHOWN:
                return "Shown media"
            case BackgroundScope.ALL:
                return "All media"
