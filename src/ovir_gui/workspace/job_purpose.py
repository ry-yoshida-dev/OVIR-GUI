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
    RUN_MEDIA : str
        Every sampled frame of the shown video, or the shown image.
    RUN_ALL : str
        Every picture of the open media.
    UPDATE_OUTDATED : str
        Pictures recognized with other classes than the current ones.
    EXPORT : str
        Pictures without an up-to-date result, recognized before an export is written.
    """

    BACKGROUND = "background"
    RUN_CURRENT = "run_current"
    RUN_MEDIA = "run_media"
    RUN_ALL = "run_all"
    UPDATE_OUTDATED = "update_outdated"
    EXPORT = "export"

    @property
    def title(self) -> str:
        """
        Name shown with the progress.

        Returns
        -------
        str
            E.g. ``"Run All"``.
        """
        match self:
            case JobPurpose.BACKGROUND:
                return "Background"
            case JobPurpose.RUN_CURRENT:
                return "Run"
            case JobPurpose.RUN_MEDIA:
                return "Run Video"
            case JobPurpose.RUN_ALL:
                return "Run All"
            case JobPurpose.UPDATE_OUTDATED:
                return "Update Outdated"
            case JobPurpose.EXPORT:
                return "Export"

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

    @property
    def is_blocking(self) -> bool:
        """
        Whether the interface shows the job as a modal progress the user can only cancel.

        Returns
        -------
        bool
            True for exports.
        """
        return self is JobPurpose.EXPORT
