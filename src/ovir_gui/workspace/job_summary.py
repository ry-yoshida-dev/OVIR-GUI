from dataclasses import dataclass

from ..media import FrameKey


@dataclass(frozen=True)
class JobSummary:
    """
    How a job ended.

    Attributes
    ----------
    recognized_count : int
        Pictures recognized.
    unreadable_keys : tuple[FrameKey, ...]
        Pictures that could not be read.
    is_cancelled : bool
        Whether the user cancelled the job.
    is_interrupted : bool
        Whether the job yielded to other work before its end.
    """

    recognized_count: int
    unreadable_keys: tuple[FrameKey, ...]
    is_cancelled: bool
    is_interrupted: bool

    @property
    def is_complete(self) -> bool:
        """
        Whether every picture was handed back.

        Returns
        -------
        bool
            True unless cancelled or interrupted.
        """
        return not (self.is_cancelled or self.is_interrupted)
