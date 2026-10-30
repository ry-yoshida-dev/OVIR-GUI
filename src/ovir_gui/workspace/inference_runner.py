from collections.abc import Callable

from ..media import FrameKey, MediaItem
from ..models import ModelProfile, RecognitionModel
from ..prompting import LabeledPrompt, PromptMode
from ..results import ResultCatalog
from .action_reply import ActionReply
from .background_planner import BackgroundPlanner
from .class_workbench import ClassWorkbench
from .export_coordinator import ExportCoordinator
from .inference_engine import InferenceEngine
from .inference_job import InferenceJob
from .job_purpose import JobPurpose
from .prompt_assembler import PromptAssembler
from .prompt_preparation import PromptPreparation
from .recognition_settings import RecognitionSettings
from .result_profiles import ResultProfiles
from .result_read_model import ResultReadModel
from .run_progress import RunProgress
from .session_mapper import SessionMapper
from .status_notifier import StatusNotifier
from .working_state import WorkingState
from .workspace_topic import WorkspaceTopic


class InferenceRunner:
    """
    Starts recognition jobs on the ``InferenceEngine``: the foreground jobs the user asks for, and background jobs
    recognizing what the inference mode covers whenever the engine is idle.

    A foreground job runs one at a time and refuses to start while another one or an export runs. Background jobs
    follow the ``BackgroundPlanner``: a picture redrawn by the user first, then the pictures of the mode with the shown
    media first, frames ahead of a playing video before the others.
    """

    def __init__(
        self,
        engine: InferenceEngine,
        planner: BackgroundPlanner,
        working: WorkingState,
        settings: RecognitionSettings,
        read_model: ResultReadModel,
        prompts: PromptAssembler,
        workbench: ClassWorkbench,
        notifier: StatusNotifier,
        exports: ExportCoordinator,
        profiles: ResultProfiles,
        session: SessionMapper,
        current_model: Callable[[], RecognitionModel],
    ) -> None:
        """
        Parameters
        ----------
        engine : InferenceEngine
            Worker running the jobs.
        planner : BackgroundPlanner
            What the background recognizes next.
        working : WorkingState
            Open media, shown picture and progress.
        settings : RecognitionSettings
            Inference mode and whether it runs automatically.
        read_model : ResultReadModel
            Pictures needing recognition.
        prompts : PromptAssembler
            Prompts of the jobs.
        workbench : ClassWorkbench
            Classes and drawings the jobs need.
        notifier : StatusNotifier
            Views told about refused requests.
        exports : ExportCoordinator
            Export keeping the workspace busy while it writes.
        profiles : ResultProfiles
            Shown profile, switched to the profile of a starting job.
        session : SessionMapper
            Session saved when automatic inference is turned off.
        current_model : Callable[[], RecognitionModel]
            Model chosen for the current task.
        """
        self._engine: InferenceEngine = engine
        self._planner: BackgroundPlanner = planner
        self._working: WorkingState = working
        self._settings: RecognitionSettings = settings
        self._read_model: ResultReadModel = read_model
        self._prompts: PromptAssembler = prompts
        self._workbench: ClassWorkbench = workbench
        self._notifier: StatusNotifier = notifier
        self._exports: ExportCoordinator = exports
        self._profiles: ResultProfiles = profiles
        self._session: SessionMapper = session
        self._current_model: Callable[[], RecognitionModel] = current_model

    @property
    def is_busy(self) -> bool:
        """
        Whether a foreground job or an export is in progress.

        Returns
        -------
        bool
            True while the user waits for a job.
        """
        return self._engine.is_busy or self._exports.is_exporting

    @property
    def is_worker_idle(self) -> bool:
        """
        Whether the worker has nothing to do.

        Returns
        -------
        bool
            True when no job runs or waits.
        """
        return self._engine.is_idle

    @property
    def background_progress(self) -> RunProgress | None:
        """
        Progress of the running background job.

        Returns
        -------
        RunProgress | None
            Titled with the file being recognized; ``None`` while no background job runs.
        """
        job: InferenceJob | None = self._running_background_job()
        if job is None:
            return None
        return RunProgress(
            title=f"{job.purpose.title}: {job.frame_keys[0].path.name}",
            processed_count=job.control.processed_count,
            total_count=len(job.frame_keys),
        )

    @property
    def background_key(self) -> FrameKey | None:
        """
        Picture the background is about to hand back.

        Returns
        -------
        FrameKey | None
            ``None`` while no background job runs.
        """
        job: InferenceJob | None = self._running_background_job()
        if job is None:
            return None
        remaining: tuple[FrameKey, ...] = job.remaining_keys
        return remaining[0] if remaining else None

    @property
    def background_pause_reason(self) -> str | None:
        """
        Error message that paused automatic inference.

        Returns
        -------
        str | None
            Message of the model error until the user acts; None while not paused.
        """
        return self._planner.pause_reason

    @property
    def is_following_playback(self) -> bool:
        """
        Whether automatic inference recognizes the frames ahead of the playing video.

        Returns
        -------
        bool
            True while the shown video plays with automatic inference on and the selected model can run in the
            background on it.
        """
        item: MediaItem | None = self._working.current_item
        if not self._settings.is_auto_inference or not self._working.is_playing or item is None or not item.is_video:
            return False
        model: RecognitionModel = self._current_model()
        if model.is_sequential or self._planner.is_paused or self._planner.is_pinned:
            return False
        if model.prompt_mode.is_class_list_needed and not self._workbench.classes:
            return False
        return self._prompts.background_prompt(model) is not None

    def run_current(self, is_skipping_approved: bool) -> ActionReply:
        """
        Recognize the shown image or video frame with the chosen model, even when it has a result.

        Parameters
        ----------
        is_skipping_approved : bool
            Whether the user approved leaving out classes the model cannot query.

        Returns
        -------
        ActionReply
            Started, refused, or waiting for approval.
        """
        current: FrameKey | None = self._working.current_key
        if current is None:
            return self._notifier.reject("Open an image or a video first.")
        return self.start(JobPurpose.RUN_CURRENT, (current,), is_skipping_approved)

    def run_all(self, is_skipping_approved: bool, start_frame: int | None = None) -> ActionReply:
        """
        Recognize every picture of the open media lacking an up-to-date result of the chosen model.

        The shown media comes first, from the shown frame on, and the other media follow in list order.

        Parameters
        ----------
        is_skipping_approved : bool
            Whether the user approved leaving out classes the model cannot query.
        start_frame : int | None, optional
            Frame of the shown video recognized first, so results arrive ahead of playback; the frames before it
            follow. From the shown frame when absent.

        Returns
        -------
        ActionReply
            Started, refused, or waiting for approval.
        """
        if not self._working.media:
            return self._notifier.reject("Open images or videos first.")
        pending: tuple[FrameKey, ...] = self._read_model.pending_keys(
            self._current_model().profile(), self._working.media.values()
        )
        if not pending:
            return self._notifier.reject("Every picture is up to date with the chosen model.")
        ordered: tuple[FrameKey, ...] = self._working.ordered_from_shown(pending, start_frame)
        return self.start(JobPurpose.RUN_ALL, ordered, is_skipping_approved)

    def update_outdated(self, is_skipping_approved: bool) -> ActionReply:
        """
        Recognize again the pictures of the shown profile recognized with other classes.

        Parameters
        ----------
        is_skipping_approved : bool
            Whether the user approved leaving out classes the model cannot query.

        Returns
        -------
        ActionReply
            Started, refused, or waiting for approval.
        """
        catalog: ResultCatalog | None = self._read_model.shown_catalog()
        profile: ModelProfile | None = self._working.shown_profile
        if catalog is None or profile is None:
            return self._notifier.reject("No results are shown.")
        outdated: tuple[FrameKey, ...] = tuple(
            self._read_model.outdated_keys(profile, self._read_model.recognized_keys(catalog))
        )
        if not outdated:
            return self._notifier.reject("No outdated pictures to update.")
        if profile != self._current_model().profile():
            return self._notifier.reject(
                f"The outdated pictures were inferred with {profile.label} ({profile.options_text}); "
                + "choose these model settings to update them."
            )
        return self.start(JobPurpose.UPDATE_OUTDATED, outdated, is_skipping_approved)

    def cancel(self) -> None:
        """
        Stop every inference after its current mini-batch and turn automatic inference off.

        Results of finished mini-batches are kept; nothing is inferred again until the user asks for it.
        """
        self._working.requested_key = None
        if self._settings.is_auto_inference:
            self._settings.is_auto_inference = False
            self._session.save()
        self._engine.cancel()
        self._notifier.changed(WorkspaceTopic.STATE)

    def retry_background(self) -> None:
        """
        Resume automatic inference paused by a model error, retrying failed pictures.
        """
        self._planner.forget_failures()
        self.resume_background()
        self._notifier.changed(WorkspaceTopic.STATE)

    def start(self, purpose: JobPurpose, frame_keys: tuple[FrameKey, ...], is_skipping_approved: bool) -> ActionReply:
        """
        Start a foreground job with the chosen model.

        Parameters
        ----------
        purpose : JobPurpose
            Why the job runs.
        frame_keys : tuple[FrameKey, ...]
            Pictures to recognize; a sequential model receives every frame of their videos in order.
        is_skipping_approved : bool
            Whether the user approved leaving out classes the model cannot query.

        Returns
        -------
        ActionReply
            Started, refused, or waiting for approval.
        """
        if self.is_busy:
            return self._notifier.reject("An inference is already running.")
        model: RecognitionModel = self._current_model()
        if model.prompt_mode.is_class_list_needed and not self._workbench.classes:
            return self._notifier.reject("Add at least one class before running inference.")
        if model.is_sequential:
            frame_keys = self._sequential_keys(frame_keys)
        if model.prompt_mode is PromptMode.MARKS and not any(
            self._workbench.picture_board.prompts.relevant_to(key, model.is_sequential).marks for key in frame_keys
        ):
            return self._notifier.reject(
                f"{model.preset.label} segments the objects you mark: choose Objects in the drawing bar and a class, "
                + "then click on an object or drag a box around it in the viewer."
            )
        preparation: PromptPreparation = self._prompts.prepare(model, is_skipping_approved)
        if preparation.prompt is None:
            if preparation.unapproved_class_names:
                return ActionReply.needing_approval(model.preset.label, preparation.unapproved_class_names)
            return self._notifier.reject(preparation.issue)
        job: InferenceJob = InferenceJob(
            purpose=purpose,
            model=model,
            prompt=preparation.prompt,
            frame_keys=frame_keys,
            media=dict(self._working.media),
        )
        self._planner.unpin()
        self._planner.resume()
        self._profiles.switch_to(job.profile)
        self._working.progress = RunProgress(title=purpose.title, processed_count=0, total_count=len(frame_keys))
        self._engine.submit(job)
        return ActionReply.done()

    def interrupt_background(self) -> None:
        """
        Ask a running background job to yield after its current mini-batch.
        """
        self._engine.interrupt_background()

    def restart_background(self) -> None:
        """
        Interrupt the running background job and plan the background again, e.g. after the settings changed.
        """
        self._engine.interrupt_background()
        self.resume_background()

    def resume_background(self) -> None:
        """
        Resume the background and start its next job, if any.
        """
        self._planner.resume()
        self.continue_background()

    def prioritize_shown(self) -> None:
        """
        Make the running background job yield when the shown picture needs recognition and is not coming soon, then
        continue in the background.
        """
        job: InferenceJob | None = self._running_background_job()
        current: FrameKey | None = self._working.current_key
        if job is not None and current is not None:
            upcoming: tuple[FrameKey, ...] = job.remaining_keys[: job.model.batch_size * 2]
            is_current_pending: bool = not self._read_model.up_to_date_check(job.profile)(current)
            is_expected: bool = current in self._read_model.expected_keys(self._working.media[current.path])
            if is_current_pending and is_expected and current not in upcoming:
                self._engine.interrupt_background()
        self.resume_background()

    def continue_background(self) -> None:
        """
        Start the next background job when the engine is idle and something needs recognition.
        """
        if self.is_busy or not self._engine.is_idle:
            return
        model: RecognitionModel = self._current_model()
        current: FrameKey | None = self._working.current_key
        if current is None or (model.prompt_mode.is_class_list_needed and not self._workbench.classes):
            return
        profile: ModelProfile = model.profile()
        is_settled: Callable[[FrameKey], bool] = self._read_model.settled_check(profile)
        keys: tuple[FrameKey, ...] = self._requested_keys(is_settled)
        if not keys and self._settings.is_auto_inference:
            keys = self._planner.next_keys(
                profile,
                self._settings.inference_mode,
                current,
                tuple(self._working.media.values()),
                self._read_model.expected_keys,
                is_settled,
                self._working.is_playing,
            )
        if not keys:
            return
        prompt: LabeledPrompt | None = self._prompts.background_prompt(model)
        if prompt is None:
            return
        job: InferenceJob = InferenceJob(
            purpose=JobPurpose.BACKGROUND, model=model, prompt=prompt, frame_keys=keys, media=dict(self._working.media)
        )
        if self._engine.is_accepting(job):
            self._engine.submit(job)
            self._profiles.switch_to(profile)

    def stop(self) -> None:
        """
        Cancel every job and ask the worker to quit after the current mini-batch, without waiting.
        """
        self._engine.stop()

    def join(self, timeout_seconds: float) -> bool:
        """
        Wait until the worker has quit; the only method safe to call from a thread other than the owner.

        Parameters
        ----------
        timeout_seconds : float
            Longest wait; a worker still busy afterwards is left behind.

        Returns
        -------
        bool
            Whether the worker has quit.
        """
        return self._engine.join(timeout_seconds)

    def _running_background_job(self) -> InferenceJob | None:
        job: InferenceJob | None = self._engine.running_job
        return None if job is None or job.purpose.is_foreground else job

    def _requested_keys(self, is_settled: Callable[[FrameKey], bool]) -> tuple[FrameKey, ...]:
        requested: FrameKey | None = self._working.requested_key
        self._working.requested_key = None
        if requested is None or requested.path not in self._working.media or self._planner.is_paused:
            return ()
        return () if is_settled(requested) else (requested,)

    def _sequential_keys(self, frame_keys: tuple[FrameKey, ...]) -> tuple[FrameKey, ...]:
        ordered: list[FrameKey] = []
        for path in dict.fromkeys(key.path for key in frame_keys):
            item: MediaItem = self._working.media[path]
            if not item.is_video:
                ordered.append(item.key_at(None))
                continue
            keys: set[FrameKey] = {
                *self._read_model.expected_keys(item),
                *self._workbench.picture_board.prompts.marked_keys(path),
            }
            keys.update(key for key in frame_keys if key.path == path)
            ordered.extend(sorted(keys, key=lambda key: key.sort_key()))
        return tuple(ordered)
