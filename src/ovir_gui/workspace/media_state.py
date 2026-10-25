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

    @classmethod
    def of_counts(
        cls, expected_count: int, recognized_count: int, outdated_count: int, failed_count: int
    ) -> "MediaState":
        """
        State of a file from the counts of its expected pictures.

        Parameters
        ----------
        expected_count : int
            Pictures of the file that are recognized.
        recognized_count : int
            Pictures with an up-to-date result.
        outdated_count : int
            Pictures recognized with other classes.
        failed_count : int
            Pictures that could not be recognized.

        Returns
        -------
        MediaState
            Outdated before done, failed only when nothing is recognized, partial while some pictures are missing.
        """
        if outdated_count:
            return cls.OUTDATED
        if recognized_count == expected_count:
            return cls.DONE
        if failed_count and not recognized_count:
            return cls.FAILED
        if recognized_count:
            return cls.PARTIAL
        return cls.NOT_ANALYZED
