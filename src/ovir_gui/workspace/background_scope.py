from enum import Enum


class BackgroundScope(Enum):
    """
    Which images are recognized in the background while the user works; videos are recognized only when run.

    Attributes
    ----------
    OFF : str
        None; only what the user runs.
    SHOWN : str
        The shown image.
    ALL : str
        The shown image first, then every other open image.
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
            E.g. ``"Shown image"``.
        """
        match self:
            case BackgroundScope.OFF:
                return "Off"
            case BackgroundScope.SHOWN:
                return "Shown image"
            case BackgroundScope.ALL:
                return "All images"
