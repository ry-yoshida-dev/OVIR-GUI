from typing import Protocol

from ..media import FrameKey
from ..models import RecognitionOutcome
from .inference_job import InferenceJob
from .job_summary import JobSummary


class InferenceListener(Protocol):
    """
    Receiver of what the ``InferenceEngine`` reports, always called on the owning thread.
    """

    def on_busy_changed(self, is_busy: bool) -> None:
        """
        A foreground job was requested or has ended.

        Parameters
        ----------
        is_busy : bool
            Whether a foreground job is requested or running now.
        """
        ...

    def on_activity(self, message: str) -> None:
        """
        The worker started something worth showing.

        Parameters
        ----------
        message : str
            E.g. the model being loaded.
        """
        ...

    def on_recognized(self, job: InferenceJob, frame_keys: tuple[FrameKey, ...], outcome: RecognitionOutcome) -> None:
        """
        A mini-batch was recognized.

        Parameters
        ----------
        job : InferenceJob
            Job the mini-batch belongs to.
        frame_keys : tuple[FrameKey, ...]
            Pictures of the mini-batch, in the order of ``outcome.results``.
        outcome : RecognitionOutcome
            Results and timing.
        """
        ...

    def on_progressed(self, job: InferenceJob) -> None:
        """
        A job handed back more pictures.

        Parameters
        ----------
        job : InferenceJob
            Running job; its control tells how many pictures are done.
        """
        ...

    def on_finished(self, job: InferenceJob, summary: JobSummary) -> None:
        """
        A job ended, completely or not.

        Parameters
        ----------
        job : InferenceJob
            Ended job.
        summary : JobSummary
            Counts and how it ended.
        """
        ...

    def on_failed(self, job: InferenceJob, message: str) -> None:
        """
        The model failed; the job stopped.

        Parameters
        ----------
        job : InferenceJob
            Failed job.
        message : str
            Error with the picture it happened on.
        """
        ...
