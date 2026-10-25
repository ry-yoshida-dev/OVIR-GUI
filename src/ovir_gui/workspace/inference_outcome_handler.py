from collections.abc import Callable

from ..media import FrameKey
from ..models import ModelProfile, RecognitionOutcome
from ..recognition import FrameResult
from ..results import ResultLibrary
from ..storage import ResultsSnapshot
from .background_planner import BackgroundPlanner
from .deferred_save import DeferredSave
from .export_coordinator import ExportCoordinator
from .export_request import ExportRequest
from .inference_job import InferenceJob
from .job_purpose import JobPurpose
from .job_summary import JobSummary
from .run_progress import RunProgress
from .status_notifier import StatusNotifier
from .working_state import WorkingState
from .workspace_topic import WorkspaceTopic


class InferenceOutcomeHandler:
    """
    ``InferenceListener`` of the workspace: stores what the ``InferenceEngine`` recognized, reports the progress and
    the end of every job, writes the export a job ran for, and continues in the background once a job ended.
    """

    def __init__(
        self,
        working: WorkingState,
        library: ResultLibrary,
        planner: BackgroundPlanner,
        notifier: StatusNotifier,
        exports: ExportCoordinator,
        results_save: DeferredSave[ResultsSnapshot],
        is_worker_idle: Callable[[], bool],
        continue_background: Callable[[], None],
        resume_background: Callable[[], None],
    ) -> None:
        """
        Parameters
        ----------
        working : WorkingState
            Shown picture, open media and progress of the foreground job.
        library : ResultLibrary
            Results receiving every recognized picture.
        planner : BackgroundPlanner
            Background state, remembering failures and pauses.
        notifier : StatusNotifier
            Views told about the jobs.
        exports : ExportCoordinator
            Export waiting for its job.
        results_save : DeferredSave[ResultsSnapshot]
            Save of the results after every change.
        is_worker_idle : Callable[[], bool]
            Whether the inference worker has nothing to do, so the activity message can be cleared.
        continue_background : Callable[[], None]
            Starts the next background job, if any.
        resume_background : Callable[[], None]
            Resumes the background and starts its next job.
        """
        self._working: WorkingState = working
        self._library: ResultLibrary = library
        self._planner: BackgroundPlanner = planner
        self._notifier: StatusNotifier = notifier
        self._exports: ExportCoordinator = exports
        self._results_save: DeferredSave[ResultsSnapshot] = results_save
        self._is_worker_idle: Callable[[], bool] = is_worker_idle
        self._continue_background: Callable[[], None] = continue_background
        self._resume_background: Callable[[], None] = resume_background

    def on_busy_changed(self, is_busy: bool) -> None:
        """
        Follow the foreground jobs of the engine.

        Parameters
        ----------
        is_busy : bool
            Whether a foreground job is requested or running.
        """
        if not is_busy:
            self._working.progress = None
            self._clear_activity_when_idle()
        self._notifier.changed(WorkspaceTopic.STATE)

    def on_activity(self, message: str) -> None:
        """
        Show what the worker is doing.

        Parameters
        ----------
        message : str
            Progress message.
        """
        self._notifier.show_activity(message)
        self._notifier.changed(WorkspaceTopic.STATE)

    def on_recognized(self, job: InferenceJob, frame_keys: tuple[FrameKey, ...], outcome: RecognitionOutcome) -> None:
        """
        Store the results of one mini-batch.

        Parameters
        ----------
        job : InferenceJob
            Job of the mini-batch.
        frame_keys : tuple[FrameKey, ...]
            Pictures in the order of the results.
        outcome : RecognitionOutcome
            Results and timing.
        """
        profile: ModelProfile = job.profile
        for frame_key, result in zip(frame_keys, outcome.results, strict=True):
            self._library.record(profile, frame_key, result, job.prompt.signature_of(frame_key))
        self._results_save.schedule()
        if self._working.current_key in frame_keys:
            self._summarize(job, outcome, frame_keys)
        if profile == self._working.shown_profile and any(key.path in self._working.media for key in frame_keys):
            self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        else:
            self._notifier.changed(WorkspaceTopic.STATE)

    def on_progressed(self, job: InferenceJob) -> None:
        """
        Show the progress of a foreground job.

        Parameters
        ----------
        job : InferenceJob
            Running job.
        """
        if not job.purpose.is_foreground:
            return
        self._working.progress = RunProgress(
            title=job.purpose.title,
            processed_count=job.control.processed_count,
            total_count=len(job.frame_keys),
            is_blocking=job.purpose.is_blocking,
        )
        self._notifier.changed(WorkspaceTopic.STATE)

    def on_finished(self, job: InferenceJob, summary: JobSummary) -> None:
        """
        Report an ended job, write the export it ran for, and continue in the background.

        Parameters
        ----------
        job : InferenceJob
            Ended job.
        summary : JobSummary
            Counts and how it ended.
        """
        if summary.unreadable_keys:
            self._planner.record_failures(job.profile, summary.unreadable_keys)
        unreadable_note: str = (
            f" ({len(summary.unreadable_keys)} unreadable skipped)" if summary.unreadable_keys else ""
        )
        match job.purpose:
            case JobPurpose.BACKGROUND:
                pass
            case JobPurpose.RUN_CURRENT:
                self._notifier.inform(
                    f"Done{unreadable_note}." if summary.recognized_count else f"Nothing inferred{unreadable_note}."
                )
            case JobPurpose.RUN_ALL | JobPurpose.UPDATE_OUTDATED:
                verb: str = "stopped after" if summary.is_cancelled else "inferred"
                self._notifier.inform(
                    f"{job.purpose.title} {verb} {summary.recognized_count} pictures{unreadable_note}."
                )
            case JobPurpose.EXPORT:
                request: ExportRequest | None = self._exports.take_pending()
                if summary.is_cancelled:
                    self._notifier.inform(f"Export cancelled after {summary.recognized_count} pictures.")
                elif request is not None:
                    self._exports.write(job.profile, request, self._resume_background)
        self._clear_activity_when_idle()
        self._notifier.changed(WorkspaceTopic.STATE)
        self._continue_background()

    def on_failed(self, job: InferenceJob, message: str) -> None:
        """
        Report a job stopped by a model error; a failed background job pauses the background.

        Parameters
        ----------
        job : InferenceJob
            Failed job.
        message : str
            Error message.
        """
        self._clear_activity_when_idle()
        if job.purpose is JobPurpose.EXPORT:
            self._exports.hold(None)
        if job.purpose.is_foreground:
            self._notifier.alert(f"{job.purpose.title} failed", message)
        else:
            self._planner.pause(message)
            self._notifier.inform(f"Background inference paused: {message}")
        self._notifier.changed(WorkspaceTopic.STATE)
        self._continue_background()

    def _clear_activity_when_idle(self) -> None:
        if self._is_worker_idle():
            self._notifier.clear_activity()

    def _summarize(self, job: InferenceJob, outcome: RecognitionOutcome, frame_keys: tuple[FrameKey, ...]) -> None:
        if self._working.current_key is None:
            return
        result: FrameResult = outcome.results[frame_keys.index(self._working.current_key)]
        load_note: str = " (model loaded)" if outcome.is_model_reloaded else ""
        per_picture_ms: float = outcome.inference_seconds * 1000 / max(1, len(frame_keys))
        finding_count: int = len(result.findings_of(result.native_label_mode))
        self._working.summary = (
            f"{job.model.preset.label} | {job.model.weights_path} | {job.prompt.description} | "
            + f"{finding_count} {job.model.task.finding_noun}s | {per_picture_ms:.0f} ms/picture{load_note}"
        )
