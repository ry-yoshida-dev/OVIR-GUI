from enum import Enum


class JobPurpose(Enum):
    """
    Why a recognition job runs.

    Attributes
    ----------
    BACKGROUND : str
        Pictures without an up-to-date result, recognized while the user works; always yields to the others.
    RUN_CURRENT : str
        The shown image or video frame, at the user's request.
    RUN_ALL : str
        Every picture of the open media.
    UPDATE_OUTDATED : str
        Pictures recognized with other classes than the current ones.
    """

    BACKGROUND = "background"
    RUN_CURRENT = "run_current"
    RUN_ALL = "run_all"
    UPDATE_OUTDATED = "update_outdated"

    @property
    def title(self) -> str:
        """
        Name shown with the progress.

        Returns
        -------
        str
            E.g. ``"Infer All"``.
        """
        match self:
            case JobPurpose.BACKGROUND:
                return "Auto inference"
            case JobPurpose.RUN_CURRENT:
                return "Infer"
            case JobPurpose.RUN_ALL:
                return "Infer All"
            case JobPurpose.UPDATE_OUTDATED:
                return "Update Outdated"

    @property
    def is_foreground(self) -> bool:
        """
        Whether the user asked for the job and waits for it.

        Returns
        -------
        bool
            False only for background jobs.
        """
        return self is not JobPurpose.BACKGROUND
