from collections.abc import Callable, Iterable
from pathlib import Path
from typing import ClassVar

from ..media import FrameKey, InferenceMode, MediaCollection, MediaItem, VideoSampling
from ..models import (
    ClassificationModel,
    LicenseConsent,
    ModelProfile,
    ModelSelection,
    ModelSelector,
    RecognitionModel,
    RecognizerSession,
    TemplateCombination,
    WeightsStorage,
)
from ..prompting import PicturePromptBoard, PicturePrompts
from ..recognition import RecognitionTask
from ..results import ResultLibrary
from ..storage import ResultsSnapshot, SessionMedia
from ..vocabulary import ClassDefinition
from ..wording import CountedNoun
from .background_planner import BackgroundPlanner
from .class_workbench import ClassWorkbench
from .deferred_save import DeferredSave
from .export_coordinator import ExportCoordinator
from .inference_engine import InferenceEngine
from .inference_outcome_handler import InferenceOutcomeHandler
from .inference_runner import InferenceRunner
from .model_choice import ModelChoice
from .playback_preparer import PlaybackPreparer
from .prompt_assembler import PromptAssembler
from .recognition_settings import RecognitionSettings
from .result_profiles import ResultProfiles
from .result_read_model import ResultReadModel
from .review_settings import ReviewSettings
from .run_progress import RunProgress
from .session_mapper import SessionMapper
from .status_notifier import StatusNotifier
from .task_scheduler import TaskScheduler
from .text_template_library import TextTemplateLibrary
from .working_state import WorkingState
from .workspace_stores import WorkspaceStores
from .workspace_topic import WorkspaceTopic


class Workspace:
    """
    Everything the user works on, independent of any user interface: open images and videos, the shown picture,
    classes, the model of every task, stored results and the recognition jobs of the worker thread.

    The workspace lives on one owning thread, like the GUI thread of a desktop application: every method is called
    there, and the worker hands its outcomes back through the ``TaskScheduler``. Views follow it through its
    ``notifier``, told which parts changed and which notices to show. The workspace coordinates its parts: the
    ``read_model`` answering what the results say, the ``review`` settings, the ``playback`` copies of videos and the
    ``exports``.

    An image is recognized once; a video on its sampled frames (every ``VideoSampling.frame_step``-th frame), and any
    other frame on request. Results are kept per model profile, so switching tasks or models keeps every result.
    With auto inference on, pictures without an up-to-date result of the selected model are recognized in the
    background as far as the inference mode allows: the shown picture only, or every picture with the shown media
    first. While the shown video plays, its frames ahead of playback are recognized first, so the player can show them
    as it goes. A foreground job (Infer, Infer All, Update Outdated) interrupts it after the current
    mini-batch. Every task keeps its own classes and drawings, shown again when the task is chosen. Editing the classes
    keeps every result and reports pictures recognized with other classes as outdated.
    Results are saved shortly after every change, the session whenever it changes.
    """

    DEFAULT_CLASS_NAMES: ClassVar[tuple[str, ...]] = ("person", "car", "dog")
    SAVE_DELAY_SECONDS: ClassVar[float] = 2.0
    DEFAULT_TASK: ClassVar[RecognitionTask] = RecognitionTask.DETECTION

    def __init__(
        self,
        model_selector: ModelSelector,
        stores: WorkspaceStores,
        scheduler: TaskScheduler,
        session: RecognizerSession | None = None,
        weights_storage: WeightsStorage | None = None,
    ) -> None:
        """
        Parameters
        ----------
        model_selector : ModelSelector
            Presets of every task and the devices of this machine.
        stores : WorkspaceStores
            Data directory read at start and written after changes.
        scheduler : TaskScheduler
            Thread owning the workspace.
        session : RecognizerSession | None, optional
            Session keeping the loaded model; a new one by default.
        weights_storage : WeightsStorage | None, optional
            Downloaded weights of the presets; the caches of this computer by default.
        """
        self._stores: WorkspaceStores = stores
        self._notifier: StatusNotifier = StatusNotifier()
        self._working: WorkingState = WorkingState()
        self._settings: RecognitionSettings = RecognitionSettings(
            task=self.DEFAULT_TASK if self.DEFAULT_TASK in model_selector.tasks else model_selector.tasks[0]
        )
        self._library: ResultLibrary = self._load_results()
        self._results_save: DeferredSave[ResultsSnapshot] = DeferredSave(
            scheduler,
            self.SAVE_DELAY_SECONDS,
            lambda: stores.results_store.snapshot(self._library),
            stores.results_store.write,
            lambda error: self._notifier.inform(f"Could not save the results: {error}"),
        )
        self._review: ReviewSettings = ReviewSettings(
            stores.class_threshold_store,
            stores.duplicate_suppression_store,
            stores.label_mode_store,
            self._settings,
            self._notifier,
        )
        self._text_templates: TextTemplateLibrary = TextTemplateLibrary(
            stores.text_template_store, model_selector, self._notifier
        )
        self._workbench: ClassWorkbench = ClassWorkbench(stores.class_set_store, self._settings)
        remembered_prompts: dict[RecognitionTask, PicturePrompts] = stores.picture_prompt_store.load()
        for task in RecognitionTask:
            remembered_classes: tuple[ClassDefinition, ...] | None = stores.class_list_store.load(task)
            self._workbench.restore(
                task,
                tuple(ClassDefinition.named(name) for name in self.DEFAULT_CLASS_NAMES)
                if remembered_classes is None
                else remembered_classes,
                remembered_prompts[task],
            )
        self._planner: BackgroundPlanner = BackgroundPlanner()
        self._models: ModelChoice = ModelChoice(
            model_selector,
            LicenseConsent(stores.license_consent_store.load()),
            stores.license_consent_store,
            WeightsStorage.on_this_computer() if weights_storage is None else weights_storage,
            self._settings,
            self._planner,
            self._notifier,
            lambda: self._jobs.is_busy,
            self._model_chosen,
        )
        self._read_model: ResultReadModel = ResultReadModel(
            self._working, self._settings, self._library, self._workbench, self._review, self._planner
        )
        self._prompts: PromptAssembler = PromptAssembler(self._working, self._workbench)
        self._playback: PlaybackPreparer = PlaybackPreparer(
            scheduler, stores.playback_store, self._working, self._notifier
        )
        self._session: SessionMapper = SessionMapper(
            model_selector,
            self._models.license_consent,
            stores.session_store,
            self._notifier,
            self._working,
            self._settings,
        )
        self._exports: ExportCoordinator = ExportCoordinator(
            scheduler,
            self._notifier,
            self._working,
            self._library,
            self._read_model,
            self._review,
            self._workbench,
            lambda: self._jobs.is_worker_idle,
            lambda: self._models.current_model().profile(),
            lambda: self._jobs.is_busy,
            lambda: self._jobs.resume_background(),
        )
        self._profiles: ResultProfiles = ResultProfiles(
            self._working,
            self._settings,
            self._library,
            self._read_model,
            self._planner,
            self._notifier,
            self._results_save,
            self._models.current_model,
            lambda: self._jobs.interrupt_background(),
            lambda: self._jobs.resume_background(),
        )
        engine: InferenceEngine = InferenceEngine(
            scheduler,
            InferenceOutcomeHandler(
                self._working,
                self._library,
                self._planner,
                self._notifier,
                self._results_save,
                lambda: self._jobs.is_worker_idle,
                lambda: self._jobs.continue_background(),
            ),
            session,
        )
        self._jobs: InferenceRunner = InferenceRunner(
            engine,
            self._planner,
            self._working,
            self._settings,
            self._read_model,
            self._prompts,
            self._workbench,
            self._notifier,
            self._exports,
            self._profiles,
            self._session,
            self._models.current_model,
        )
        self._session.apply_stored()
        self._library.apply_template_combination(self._template_combination())
        self._profiles.show_profile_of_task()

    @property
    def models(self) -> ModelChoice:
        """
        Model chosen for each task and the accepted licenses.

        Returns
        -------
        ModelChoice
            Model choice of the workspace.
        """
        return self._models

    @property
    def stores(self) -> WorkspaceStores:
        """
        Data directory of the workspace.

        Returns
        -------
        WorkspaceStores
            Stores given at construction.
        """
        return self._stores

    @property
    def notifier(self) -> StatusNotifier:
        """
        Observers of the workspace with the status and activity messages they show.

        Returns
        -------
        StatusNotifier
            Notifier of the workspace.
        """
        return self._notifier

    @property
    def read_model(self) -> ResultReadModel:
        """
        What the stored results say about the open media.

        Returns
        -------
        ResultReadModel
            Statuses, summaries, statistics and comparison of the results.
        """
        return self._read_model

    @property
    def review(self) -> ReviewSettings:
        """
        Label mode, minimums and duplicate suppression of the review, per task.

        Returns
        -------
        ReviewSettings
            Review settings; changing them only filters the stored results again.
        """
        return self._review

    @property
    def text_templates(self) -> TextTemplateLibrary:
        """
        Text templates saved for reuse by every classifier.

        Returns
        -------
        TextTemplateLibrary
            Saved templates of the data directory.
        """
        return self._text_templates

    @property
    def playback(self) -> PlaybackPreparer:
        """
        Browser-playable copies of the open videos.

        Returns
        -------
        PlaybackPreparer
            State and preparation of the copies.
        """
        return self._playback

    @property
    def exports(self) -> ExportCoordinator:
        """
        Exports of the stored results.

        Returns
        -------
        ExportCoordinator
            Running and last finished export.
        """
        return self._exports

    @property
    def jobs(self) -> InferenceRunner:
        """
        Recognition jobs, foreground and background.

        Returns
        -------
        InferenceRunner
            Runner starting, cancelling and reporting the jobs.
        """
        return self._jobs

    @property
    def profiles(self) -> ResultProfiles:
        """
        Shown and compared result profiles and the review of their findings.

        Returns
        -------
        ResultProfiles
            Profiles of the stored results.
        """
        return self._profiles

    @property
    def media(self) -> tuple[MediaItem, ...]:
        """
        Open images and videos.

        Returns
        -------
        tuple[MediaItem, ...]
            Media in list order.
        """
        return tuple(self._working.media.values())

    def media_item(self, path: Path) -> MediaItem:
        """
        One open file.

        Parameters
        ----------
        path : Path
            Open image or video.

        Returns
        -------
        MediaItem
            The item.

        Raises
        ------
        KeyError
            If the file is not open.
        """
        return self._working.media_item(path)

    @property
    def current_key(self) -> FrameKey | None:
        """
        Shown image or video frame.

        Returns
        -------
        FrameKey | None
            ``None`` while nothing is open.
        """
        return self._working.current_key

    @property
    def current_item(self) -> MediaItem | None:
        """
        Shown file.

        Returns
        -------
        MediaItem | None
            ``None`` while nothing is open.
        """
        return self._working.current_item

    @property
    def sampling(self) -> VideoSampling:
        """
        Sampled frames of videos in the current task.

        Returns
        -------
        VideoSampling
            Sampling of the current task.
        """
        return self._settings.sampling

    @property
    def inference_mode(self) -> InferenceMode:
        """
        Which pictures of the current task are inferred, automatically while the user works and by Infer.

        Returns
        -------
        InferenceMode
            Mode of the current task.
        """
        return self._settings.inference_mode

    @property
    def is_auto_inference(self) -> bool:
        """
        Whether the pictures of the inference mode are inferred automatically while the user works.

        Returns
        -------
        bool
            False when pictures are inferred only at the user's request.
        """
        return self._settings.is_auto_inference

    @property
    def task(self) -> RecognitionTask:
        """
        Task chosen in the model settings.

        Returns
        -------
        RecognitionTask
            Current task.
        """
        return self._settings.task

    @property
    def workbench(self) -> ClassWorkbench:
        """
        Classes of the current task with their phrases and reference images.

        Returns
        -------
        ClassWorkbench
            Classes; edit them through ``edit_classes``.
        """
        return self._workbench

    @property
    def library(self) -> ResultLibrary:
        """
        Stored results of every profile.

        Returns
        -------
        ResultLibrary
            Results; change them only through the workspace.
        """
        return self._library

    @property
    def shown_profile(self) -> ModelProfile | None:
        """
        Profile whose results are shown.

        Returns
        -------
        ModelProfile | None
            ``None`` while no results of the current task are shown.
        """
        return self._working.shown_profile

    @property
    def compared_profile(self) -> ModelProfile | None:
        """
        Profile compared with the shown one.

        Returns
        -------
        ModelProfile | None
            ``None`` while none is compared.
        """
        return self._working.compared_profile

    @property
    def summary(self) -> str:
        """
        Model, prompt, finding count and time of the latest recognition of the shown picture.

        Returns
        -------
        str
            One line; empty when the shown picture was not recognized since it was shown.
        """
        return self._working.summary

    @property
    def progress(self) -> RunProgress | None:
        """
        Progress of the foreground job.

        Returns
        -------
        RunProgress | None
            ``None`` while none runs.
        """
        return self._working.progress

    @property
    def is_busy(self) -> bool:
        """
        Whether a foreground job or an export is in progress.

        Returns
        -------
        bool
            True while the user waits for a job.
        """
        return self._jobs.is_busy

    def open_paths(self, paths: Iterable[Path], is_first_shown: bool = True) -> None:
        """
        Add image and video files, or every one inside directories, to the open media.

        Parameters
        ----------
        paths : Iterable[Path]
            Files and directories.
        is_first_shown : bool, optional
            Whether the first added file is shown; otherwise only when nothing was shown.
        """
        collection: MediaCollection = MediaCollection.gather(paths, self._working.media)
        if collection.is_empty:
            self._notifier.inform(collection.describe("No new images or videos found"))
            return
        added: list[MediaItem] = []
        unreadable: list[str] = []
        for path in collection.media_paths:
            try:
                added.append(MediaItem.open(path))
            except (OSError, ValueError) as error:
                unreadable.append(f"{path.name} ({error})")
        for item in added:
            self._working.media[item.path] = item
        if added and (is_first_shown or self._working.current_key is None):
            self._working.show_key(added[0].key_at(0))
        video_count: int = sum(1 for item in added if item.is_video)
        image_count: int = len(added) - video_count
        parts: list[str] = []
        if image_count:
            parts.append(CountedNoun("image").of(image_count))
        if video_count:
            parts.append(CountedNoun("video").of(video_count))
        headline: str = f"Added {' and '.join(parts)}" if parts else "Added nothing"
        if unreadable:
            headline = f"{headline}; could not open {', '.join(unreadable)}"
        self._notifier.inform(collection.describe(headline))
        self._session.save()
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        self._jobs.resume_background()

    def restore_session(self) -> None:
        """
        Open the media the current task had open in the last session again and show the picture shown then; missing
        files are skipped. The media of the other tasks are opened when they are shown.
        """
        self._open_remembered_media()

    def close_media(self, paths: Iterable[Path]) -> None:
        """
        Close files, keeping their stored results; when the shown file is closed, the next remaining one is shown.

        Parameters
        ----------
        paths : Iterable[Path]
            Open files to close; others are ignored.
        """
        closed: frozenset[Path] = frozenset(paths) & frozenset(self._working.media)
        if not closed:
            return
        current: FrameKey | None = self._working.current_key
        if current is not None and current.path in closed:
            following: Path | None = self._working.next_remaining_path(closed)
            self._working.show_key(None if following is None else self._working.media[following].key_at(0))
        for path in closed:
            del self._working.media[path]
        self._notifier.inform(f"Closed {CountedNoun('file').of(len(closed))}.")
        self._settings_changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def show(self, path: Path, frame_index: int | None = None, is_playing: bool = False) -> None:
        """
        Show an open image, or a frame of an open video; it is recognized first when it has no up-to-date result.

        Parameters
        ----------
        path : Path
            Open file.
        frame_index : int | None, optional
            Frame of a video, clamped to its frames; the first frame when ``None`` and the video was not shown.
        is_playing : bool, optional
            Whether the video plays from the frame, so automatic inference recognizes the frames ahead of it first.

        Raises
        ------
        KeyError
            If the file is not open.
        """
        item: MediaItem = self.media_item(path)
        current: FrameKey | None = self._working.current_key
        if frame_index is None and current is not None and current.path == path:
            frame_index = current.frame_index
        key: FrameKey = item.key_at(frame_index)
        is_playing = is_playing and item.is_video
        is_playing_changed: bool = is_playing != self._working.is_playing
        if key == current and not is_playing_changed:
            return
        self._working.is_playing = is_playing
        if key != current:
            self._working.current_key = key
            if current is None or current.path != path:
                self._working.summary = ""
            self._session.save()
        self._notifier.changed(WorkspaceTopic.STATE)
        if is_playing_changed:
            self._jobs.restart_background()
        else:
            self._jobs.prioritize_shown()

    def set_sampling(self, frame_step: int) -> None:
        """
        Recognize every ``frame_step``-th frame of videos in the current task; results of other frames are kept.

        Parameters
        ----------
        frame_step : int
            Distance between sampled frames.

        Raises
        ------
        ValueError
            If the step is not positive.
        """
        sampling: VideoSampling = VideoSampling(frame_step)
        if sampling == self._settings.sampling:
            return
        self._settings.sampling = sampling
        self._settings_changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def set_inference(self, mode: InferenceMode, is_auto: bool) -> None:
        """
        Choose which pictures of the current task are inferred, and whether automatically.

        Parameters
        ----------
        mode : InferenceMode
            New mode.
        is_auto : bool
            Whether the pictures of the mode are inferred automatically while the user works.
        """
        if mode is self._settings.inference_mode and is_auto == self._settings.is_auto_inference:
            return
        self._settings.inference_mode = mode
        self._settings.is_auto_inference = is_auto
        self._settings_changed(WorkspaceTopic.STATE)

    def select_task(self, task: RecognitionTask) -> None:
        """
        Switch to another task; its model, classes, media, results, compared results, class minimums, sampling and
        inference choices are shown.

        Parameters
        ----------
        task : RecognitionTask
            Task with at least one preset.

        Raises
        ------
        ValueError
            If a foreground job runs or the task has no preset.
        """
        if self.is_busy:
            raise ValueError("The task cannot be changed while an inference is running.")
        if task not in self._models.model_selector.tasks:
            raise ValueError(f"No {task.value} models are available.")
        if task is self._settings.task:
            return
        is_media_kept: bool = self._working.switch_media(self._settings.task, task)
        kept_comparison: ModelProfile | None = self._working.switch_comparison(self._settings.task, task)
        self._settings.task = task
        self._planner.unpin()
        self._profiles.show_profile_of_task()
        self._profiles.restore_comparison(kept_comparison)
        self._settings_changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        if not is_media_kept:
            self._open_remembered_media()

    def edit_classes(self, edit: Callable[[ClassWorkbench], object]) -> None:
        """
        Change the classes, phrases or reference images of the current task, then remember them and recognize
        outdated pictures again.

        Parameters
        ----------
        edit : Callable[[ClassWorkbench], object]
            Edit applied to the workbench; an error it raises is passed on and nothing else happens.
        """
        edit(self._workbench)
        self._notifier.save_reporting_failure(
            lambda: self._stores.class_list_store.save(self._settings.task, self._workbench.classes),
            "Could not remember the classes",
        )
        self._planner.forget_failures()
        self._planner.resume()
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS, WorkspaceTopic.CLASS_SETS)
        self._jobs.restart_background()

    def edit_class_sets(self, edit: Callable[[ClassWorkbench], object]) -> None:
        """
        Change the saved class sets without changing the classes.

        Parameters
        ----------
        edit : Callable[[ClassWorkbench], object]
            Edit applied to the workbench; an error it raises is passed on.
        """
        edit(self._workbench)
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.CLASS_SETS)

    def edit_picture_prompts(self, frame_key: FrameKey, edit: Callable[[PicturePromptBoard], object]) -> None:
        """
        Change the exemplar boxes or object marks drawn on a picture for the current task, remember them, and
        recognize the shown picture again when the chosen model reads them there.

        Parameters
        ----------
        frame_key : FrameKey
            Picture the edit is drawn on.
        edit : Callable[[PicturePromptBoard], object]
            Edit applied to the drawings; an error it raises is passed on and nothing else happens.

        Raises
        ------
        KeyError
            If the picture's file is not open.
        """
        self.media_item(frame_key.path)
        edit(self._workbench.picture_board)
        self._notifier.save_reporting_failure(
            lambda: self._stores.picture_prompt_store.save(self._workbench.picture_prompts_by_task),
            "Could not remember the drawings",
        )
        model: RecognitionModel = self._models.current_model()
        is_drawing_read: bool = any(kind.is_drawn_on_picture for kind in model.supported_query_kinds)
        is_shown: bool = frame_key == self._working.current_key
        if self._settings.is_auto_inference and is_drawing_read and not model.is_sequential and is_shown:
            self._working.requested_key = frame_key
            self._planner.unpin()
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        self._jobs.restart_background()

    def save_now(self) -> None:
        """
        Write the results and the session at once on the calling thread, e.g. when the application quits.
        """
        self._notifier.save_reporting_failure(self._results_save.save_now, "Could not save the results")
        self._session.save()

    def _open_remembered_media(self) -> None:
        remembered: SessionMedia | None = self._session.take_unopened_media(self._settings.task)
        if remembered is None:
            return
        existing: list[Path] = [path for path in remembered.paths if path.is_file()]
        missing_count: int = len(remembered.paths) - len(existing)
        if not existing:
            if missing_count:
                self._notifier.inform(f"None of the {missing_count} files of the last session exist any more.")
            return
        self.open_paths(existing)
        if remembered.current_path is not None and remembered.current_path in self._working.media:
            self.show(remembered.current_path, remembered.current_frame_index)
        missing_note: str = f" ({missing_count} missing skipped)" if missing_count else ""
        self._notifier.inform(f"Restored {CountedNoun('file').of(len(existing))} of the last session{missing_note}.")

    def _load_results(self) -> ResultLibrary:
        try:
            return self._stores.results_store.load()
        except (OSError, ValueError) as error:
            self._notifier.replace_status(f"Could not restore the saved results: {error}")
            return ResultLibrary()

    def _template_combination(self) -> TemplateCombination:
        selection: ModelSelection | None = self._settings.selections.get(RecognitionTask.CLASSIFICATION)
        if selection is None or selection.template_combination is None:
            return ClassificationModel.DEFAULT_COMBINATION
        return selection.template_combination

    def _model_chosen(self) -> None:
        combination: TemplateCombination = self._template_combination()
        if combination is self._library.template_combination:
            self._settings_changed(WorkspaceTopic.STATE)
            return
        self._library.apply_template_combination(combination)
        self._results_save.schedule()
        self._settings_changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def _settings_changed(self, *topics: WorkspaceTopic) -> None:
        self._session.save()
        self._notifier.changed(*topics)
        self._jobs.restart_background()
