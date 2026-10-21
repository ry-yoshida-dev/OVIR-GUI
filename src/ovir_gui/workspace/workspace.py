from collections.abc import Callable, Iterable, Mapping
from datetime import datetime
from pathlib import Path
from typing import ClassVar

from ..analysis import ProfileComparison, ResultStatistics
from ..export import ExportItem, ExportReport, ExportScope, ExportSelection, ResultExporter
from ..media import ClassColors, FrameKey, MediaCollection, MediaItem, PlaybackProxyWriter, VideoSampling
from ..models import (
    ModelProfile,
    ModelSelection,
    ModelSelector,
    RecognitionModel,
    RecognitionOutcome,
    RecognizerSession,
)
from ..prompting import (
    LabeledPrompt,
    PicturePromptBoard,
    PicturePrompts,
    PromptChange,
    PromptClass,
    PromptMode,
    PromptSignature,
    QueryKind,
    ReferenceBoard,
)
from ..recognition import FrameResult, RecognitionTask
from ..results import ProfileSummary, ResultCatalog, ResultLibrary, StoredResult
from ..review import ClassThresholds, DuplicateSuppression, ReviewFilter
from ..storage import ResultsSnapshot, Session
from ..vocabulary import ClassDefinition
from .action_reply import ActionReply
from .action_status import ActionStatus
from .background_planner import BackgroundPlanner
from .background_scope import BackgroundScope
from .class_workbench import ClassWorkbench
from .deferred_save import DeferredSave
from .export_plan import ExportPlan
from .export_request import ExportRequest
from .inference_engine import InferenceEngine
from .inference_job import InferenceJob
from .job_purpose import JobPurpose
from .job_summary import JobSummary
from .media_state import MediaState
from .media_status import MediaStatus
from .notice import Notice
from .playback_state import PlaybackState
from .prompt_preparation import PromptPreparation
from .run_progress import RunProgress
from .task_scheduler import TaskScheduler
from .workspace_observer import WorkspaceObserver
from .workspace_stores import WorkspaceStores
from .workspace_topic import WorkspaceTopic


class Workspace:
    """
    Everything the user works on, independent of any user interface: open images and videos, the shown picture,
    classes, the model of every task, stored results and the recognition jobs of the worker thread.

    The workspace lives on one owning thread, like the GUI thread of a desktop application: every method is called
    there, and the worker hands its outcomes back through the ``TaskScheduler``. Views follow it as
    ``WorkspaceObserver``s, told which parts changed and which notices to show.

    An image is recognized once; a video on its sampled frames (every ``VideoSampling.frame_step``-th frame), and any
    other frame on request. Results are kept per model profile, so switching tasks or models keeps every result.
    Images without an up-to-date result of the selected model are recognized in the background, the shown image first,
    as far as the background scope allows; videos are recognized only when run. A foreground job (Run, Run Video,
    Run All, Update Outdated, export) interrupts it after the current mini-batch. Editing the classes keeps every
    result and reports pictures recognized with other classes as outdated. Results are saved shortly after every
    change, the session whenever it changes.
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
        """
        self._model_selector: ModelSelector = model_selector
        self._stores: WorkspaceStores = stores
        self._scheduler: TaskScheduler = scheduler
        self._observers: list[WorkspaceObserver] = []
        self._status_message: str = "Open images or videos to start."
        self._status_serial: int = 0
        self._activity_message: str = ""
        self._summary: str = ""
        self._progress: RunProgress | None = None
        self._is_exporting: bool = False
        self._last_export: ExportReport | None = None
        self._pending_export: ExportRequest | None = None
        self._results_save: DeferredSave[ResultsSnapshot] = DeferredSave(
            scheduler,
            self.SAVE_DELAY_SECONDS,
            lambda: stores.results_store.snapshot(self._library),
            stores.results_store.write,
            lambda error: self._inform(f"Could not save the results: {error}"),
        )
        self._media: dict[Path, MediaItem] = {}
        self._current_key: FrameKey | None = None
        self._sampling: VideoSampling = VideoSampling()
        self._background_scope: BackgroundScope = BackgroundScope.ALL
        self._task: RecognitionTask = (
            self.DEFAULT_TASK if self.DEFAULT_TASK in model_selector.tasks else model_selector.tasks[0]
        )
        self._selections: dict[RecognitionTask, ModelSelection] = {}
        self._library: ResultLibrary = self._load_results()
        self._shown_profile: ModelProfile | None = None
        self._compared_profile: ModelProfile | None = None
        self._thresholds: dict[RecognitionTask, ClassThresholds] = stores.class_threshold_store.load()
        self._suppressions: dict[RecognitionTask, DuplicateSuppression] = stores.duplicate_suppression_store.load()
        self._workbench: ClassWorkbench = ClassWorkbench(stores.class_set_store)
        remembered_classes: tuple[ClassDefinition, ...] | None = stores.class_list_store.load()
        self._workbench.restore(
            tuple(ClassDefinition.named(name) for name in self.DEFAULT_CLASS_NAMES)
            if remembered_classes is None
            else remembered_classes
        )
        self._workbench.picture_board.replace(stores.picture_prompt_store.load())
        self._workbench.picture_board.retain_classes(self._workbench.class_names)
        self._requested_key: FrameKey | None = None
        self._approved_skipped_classes: frozenset[str] = frozenset()
        self._playback_writer: PlaybackProxyWriter = PlaybackProxyWriter()
        self._preparing_playback_paths: set[Path] = set()
        self._failed_playback_paths: set[Path] = set()
        self._planner: BackgroundPlanner = BackgroundPlanner()
        self._engine: InferenceEngine = InferenceEngine(scheduler, self, session)
        self._apply_stored_settings(stores.session_store.load())
        self._show_profile_of_task()

    @property
    def model_selector(self) -> ModelSelector:
        """
        Presets of every task.

        Returns
        -------
        ModelSelector
            Selector given at construction.
        """
        return self._model_selector

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
    def media(self) -> tuple[MediaItem, ...]:
        """
        Open images and videos.

        Returns
        -------
        tuple[MediaItem, ...]
            Media in list order.
        """
        return tuple(self._media.values())

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
        if path not in self._media:
            raise KeyError(f"{path} is not open")
        return self._media[path]

    def playback_state(self, path: Path) -> PlaybackState:
        """
        Whether an open video has a browser-playable copy.

        Parameters
        ----------
        path : Path
            Open video.

        Returns
        -------
        PlaybackState
            State of its copy; ``NONE`` for an image.
        """
        if path in self._preparing_playback_paths:
            return PlaybackState.PREPARING
        if path in self._failed_playback_paths:
            return PlaybackState.FAILED
        if self._stores.playback_store.existing(path) is not None:
            return PlaybackState.READY
        return PlaybackState.NONE

    def playback_path(self, path: Path) -> Path:
        """
        File the browser plays for an open video: its playable copy when one exists, else the file itself.

        Parameters
        ----------
        path : Path
            Open video.

        Returns
        -------
        Path
            File to serve.

        Raises
        ------
        KeyError
            If the file is not open.
        """
        item: MediaItem = self.media_item(path)
        return self._stores.playback_store.existing(item.path) or item.path

    def prepare_playback(self, path: Path) -> None:
        """
        Encode a browser-playable copy of an open video off the owning thread, unless one exists or is being made.

        Parameters
        ----------
        path : Path
            Open video the browser cannot decode.

        Raises
        ------
        KeyError
            If the file is not open.
        ValueError
            If the file is not a video.
        """
        item: MediaItem = self.media_item(path)
        if not item.is_video:
            raise ValueError(f"{path.name} is not a video.")
        match self.playback_state(path):
            case PlaybackState.PREPARING | PlaybackState.READY:
                return
            case PlaybackState.NONE | PlaybackState.FAILED:
                pass
        self._failed_playback_paths.discard(path)
        self._preparing_playback_paths.add(path)
        self._inform(f"The browser cannot play {path.name}; preparing a playable copy ...")
        self._scheduler.run_blocking(
            lambda: self._playback_writer.write(item, self._stores.playback_store.path_of(item.path)),
            lambda _: self._on_playback_prepared(path),
            lambda error: self._on_playback_failed(path, error),
        )

    @property
    def current_key(self) -> FrameKey | None:
        """
        Shown image or video frame.

        Returns
        -------
        FrameKey | None
            ``None`` while nothing is open.
        """
        return self._current_key

    @property
    def current_item(self) -> MediaItem | None:
        """
        Shown file.

        Returns
        -------
        MediaItem | None
            ``None`` while nothing is open.
        """
        return None if self._current_key is None else self._media.get(self._current_key.path)

    @property
    def sampling(self) -> VideoSampling:
        """
        Sampled frames of videos.

        Returns
        -------
        VideoSampling
            Current sampling.
        """
        return self._sampling

    @property
    def background_scope(self) -> BackgroundScope:
        """
        What is recognized in the background.

        Returns
        -------
        BackgroundScope
            Current scope.
        """
        return self._background_scope

    @property
    def task(self) -> RecognitionTask:
        """
        Task chosen in the model settings.

        Returns
        -------
        RecognitionTask
            Current task.
        """
        return self._task

    @property
    def selection(self) -> ModelSelection:
        """
        Model chosen for the current task.

        Returns
        -------
        ModelSelection
            Preset and overrides.
        """
        return self._selection_of(self._task)

    @property
    def workbench(self) -> ClassWorkbench:
        """
        Classes with their phrases and reference images.

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
        return self._shown_profile

    @property
    def compared_profile(self) -> ModelProfile | None:
        """
        Profile compared with the shown one.

        Returns
        -------
        ModelProfile | None
            ``None`` while none is compared.
        """
        return self._compared_profile

    @property
    def class_thresholds(self) -> ClassThresholds:
        """
        Minimum confidence of each class for the current task.

        Returns
        -------
        ClassThresholds
            Default and per-class minimums.
        """
        return self._thresholds.get(self._task, ClassThresholds())

    @property
    def duplicate_suppression(self) -> DuplicateSuppression:
        """
        Review suppression of overlapping boxes for the current task.

        Returns
        -------
        DuplicateSuppression
            Whether it runs and its overlaps.
        """
        return self._suppressions.get(self._task, DuplicateSuppression())

    @property
    def review_filter(self) -> ReviewFilter:
        """
        Which stored findings of the current task pass the review.

        Returns
        -------
        ReviewFilter
            Minimums and suppression of the current task.
        """
        return self._review_filter_of(self._task)

    @property
    def status_message(self) -> str:
        """
        Latest status for the user.

        Returns
        -------
        str
            Message, possibly empty.
        """
        return self._status_message

    @property
    def status_serial(self) -> int:
        """
        Number of status messages posted so far.

        Returns
        -------
        int
            Counter telling a repeated message from the previous one.
        """
        return self._status_serial

    @property
    def activity_message(self) -> str:
        """
        What the worker is doing.

        Returns
        -------
        str
            E.g. the model being loaded; empty while idle.
        """
        return self._activity_message

    @property
    def summary(self) -> str:
        """
        Model, prompt, finding count and time of the latest recognition of the shown picture.

        Returns
        -------
        str
            One line; empty when the shown picture was not recognized since it was shown.
        """
        return self._summary

    @property
    def progress(self) -> RunProgress | None:
        """
        Progress of the foreground job.

        Returns
        -------
        RunProgress | None
            ``None`` while none runs.
        """
        return self._progress

    @property
    def is_busy(self) -> bool:
        """
        Whether a foreground job or an export is in progress.

        Returns
        -------
        bool
            True while the user waits for a job.
        """
        return self._engine.is_busy or self._is_exporting

    @property
    def background_key(self) -> FrameKey | None:
        """
        Picture the background is about to hand back.

        Returns
        -------
        FrameKey | None
            ``None`` while no background job runs.
        """
        job: InferenceJob | None = self._engine.running_job
        if job is None or job.purpose.is_foreground:
            return None
        remaining: tuple[FrameKey, ...] = job.remaining_keys
        return remaining[0] if remaining else None

    @property
    def is_background_paused(self) -> bool:
        """
        Whether a model error paused the background.

        Returns
        -------
        bool
            True until the user acts.
        """
        return self._planner.is_paused

    @property
    def last_export(self) -> ExportReport | None:
        """
        Latest finished export.

        Returns
        -------
        ExportReport | None
            ``None`` before the first export.
        """
        return self._last_export

    def add_observer(self, observer: WorkspaceObserver) -> None:
        """
        Follow the changes and notices of the workspace.

        Parameters
        ----------
        observer : WorkspaceObserver
            View to tell.
        """
        self._observers.append(observer)

    def remove_observer(self, observer: WorkspaceObserver) -> None:
        """
        Stop telling a view.

        Parameters
        ----------
        observer : WorkspaceObserver
            View added before; nothing happens otherwise.
        """
        if observer in self._observers:
            self._observers.remove(observer)

    def current_model(self) -> RecognitionModel:
        """
        Model chosen for the current task with its overrides.

        Returns
        -------
        RecognitionModel
            Model to recognize with.
        """
        return self._model_selector.model_of(self.selection)

    def is_image_prompt_supported(self) -> bool:
        """
        Whether the chosen model takes reference images.

        Returns
        -------
        bool
            True when it accepts visual queries.
        """
        return QueryKind.VISUAL in self.current_model().supported_query_kinds

    def class_colors(self) -> dict[str, str]:
        """
        Color of every current class, followed by classes only stored results report.

        Returns
        -------
        dict[str, str]
            ``#rrggbb`` per class name.
        """
        colors: dict[str, str] = {
            name: ClassColors.hex_of(index) for index, name in enumerate(self._workbench.class_names)
        }
        return colors

    def shown_catalog(self) -> ResultCatalog | None:
        """
        Results of the shown profile.

        Returns
        -------
        ResultCatalog | None
            ``None`` while no profile is shown.
        """
        if self._shown_profile is None or self._shown_profile not in self._library:
            return None
        return self._library.catalog_of(self._shown_profile)

    def compared_catalog(self) -> ResultCatalog | None:
        """
        Results of the compared profile.

        Returns
        -------
        ResultCatalog | None
            ``None`` while none is compared.
        """
        if self._compared_profile is None or self._compared_profile not in self._library:
            return None
        return self._library.catalog_of(self._compared_profile)

    def task_profiles(self) -> tuple[ModelProfile, ...]:
        """
        Stored profiles of the current task.

        Returns
        -------
        tuple[ModelProfile, ...]
            Profiles in the order they were added.
        """
        return tuple(profile for profile in self._library.profiles if profile.task is self._task)

    def signature_for(self, profile: ModelProfile) -> Callable[[FrameKey], PromptSignature]:
        """
        What the current classes and drawings query on each picture, as results of a profile depend on them.

        Parameters
        ----------
        profile : ModelProfile
            Profile whose results are checked; a sequential profile depends on the drawings of whole videos.

        Returns
        -------
        Callable[[FrameKey], PromptSignature]
            Signature of a picture with every query kind, before narrowing to the profile.
        """
        class_signature: PromptSignature = self._workbench.reference_board.signature_of(self._workbench.classes)
        prompts: PicturePrompts = self._workbench.picture_board.prompts

        def current_of(frame_key: FrameKey) -> PromptSignature:
            return class_signature.with_drawings(prompts.relevant_to(frame_key, profile.is_sequential))

        return current_of

    def expected_keys(self, item: MediaItem) -> tuple[FrameKey, ...]:
        """
        Pictures of a file that are recognized.

        Parameters
        ----------
        item : MediaItem
            Open image or video.

        Returns
        -------
        tuple[FrameKey, ...]
            The image, or the sampled frames of the video.
        """
        return item.frame_keys(self._sampling)

    def recognized_keys(self, catalog: ResultCatalog) -> tuple[FrameKey, ...]:
        """
        Pictures of the open media a catalog holds, in media and frame order.

        Parameters
        ----------
        catalog : ResultCatalog
            Results of a profile.

        Returns
        -------
        tuple[FrameKey, ...]
            Recognized pictures of the open media.
        """
        return tuple(key for path in self._media for key in catalog.keys_of(path))

    def change_of(self, frame_key: FrameKey) -> PromptChange | None:
        """
        How the classes changed since a picture was recognized with the shown profile.

        Parameters
        ----------
        frame_key : FrameKey
            Picture to look up.

        Returns
        -------
        PromptChange | None
            ``None`` when it has no result of the shown profile.
        """
        profile: ModelProfile | None = self._shown_profile
        if profile is None:
            return None
        return self._library.prompt_change_of(profile, frame_key, self.signature_for(profile)(frame_key))

    def media_statuses(self) -> dict[Path, MediaStatus]:
        """
        Recognition state of every open file with the shown profile.

        Returns
        -------
        dict[Path, MediaStatus]
            Status per file in list order.
        """
        catalog: ResultCatalog | None = self.shown_catalog()
        profile: ModelProfile | None = self._shown_profile
        is_up_to_date: Callable[[FrameKey], bool] = self._up_to_date_check(profile)
        review_filter: ReviewFilter = self.review_filter
        statuses: dict[Path, MediaStatus] = {}
        for path, item in self._media.items():
            expected: tuple[FrameKey, ...] = self.expected_keys(item)
            recognized_count: int = 0
            outdated_count: int = 0
            failed_count: int = 0
            kept_count: int = 0
            if catalog is not None and profile is not None:
                for key in expected:
                    if key in catalog:
                        if is_up_to_date(key):
                            recognized_count += 1
                        else:
                            outdated_count += 1
                    elif self._planner.is_failed(profile, key):
                        failed_count += 1
                for key in catalog.keys_of(path):
                    stored: StoredResult | None = catalog.stored_of(key)
                    if stored is None:
                        continue
                    kept_count += sum(
                        1
                        for index in review_filter.passing_indices(stored.result.findings)
                        if stored.is_accepted(index)
                    )
            state: MediaState
            if outdated_count:
                state = MediaState.OUTDATED
            elif recognized_count == len(expected):
                state = MediaState.DONE
            elif failed_count and not recognized_count:
                state = MediaState.FAILED
            elif recognized_count:
                state = MediaState.PARTIAL
            else:
                state = MediaState.NOT_ANALYZED
            statuses[path] = MediaStatus(
                state=state,
                expected_count=len(expected),
                recognized_count=recognized_count,
                outdated_count=outdated_count,
                failed_count=failed_count,
                kept_count=kept_count,
            )
        return statuses

    def profile_summaries(self) -> tuple[ProfileSummary, ...]:
        """
        Progress and counts of every stored profile of the current task over the open media.

        Returns
        -------
        tuple[ProfileSummary, ...]
            Summaries in the order the profiles were added.
        """
        expected_by_path: dict[Path, tuple[FrameKey, ...]] = {
            path: self.expected_keys(item) for path, item in self._media.items()
        }
        expected_frame_count: int = sum(len(expected) for expected in expected_by_path.values())
        summaries: list[ProfileSummary] = []
        for profile in self.task_profiles():
            catalog: ResultCatalog = self._library.catalog_of(profile)
            done_file_count: int = 0
            recognized: list[FrameKey] = []
            for expected in expected_by_path.values():
                recognized_of_file: list[FrameKey] = [key for key in expected if key in catalog]
                recognized.extend(recognized_of_file)
                if len(recognized_of_file) == len(expected):
                    done_file_count += 1
            finding_count: int = 0
            for key in self.recognized_keys(catalog):
                stored: StoredResult | None = catalog.stored_of(key)
                if stored is not None:
                    finding_count += len(stored.result.findings)
            summaries.append(
                ProfileSummary(
                    profile=profile,
                    file_count=len(expected_by_path),
                    done_file_count=done_file_count,
                    expected_frame_count=expected_frame_count,
                    recognized_frame_count=len(recognized),
                    outdated_count=len(
                        self._library.outdated_keys(profile, self.signature_for(profile), tuple(recognized))
                    ),
                    finding_count=finding_count,
                )
            )
        return tuple(summaries)

    def statistics(self) -> ResultStatistics | None:
        """
        Per-class statistics of the shown results over the open media.

        Returns
        -------
        ResultStatistics | None
            ``None`` while no results are shown.
        """
        catalog: ResultCatalog | None = self.shown_catalog()
        if catalog is None:
            return None
        return ResultStatistics.of(
            catalog, self.recognized_keys(catalog), self._workbench.class_names, self.review_filter
        )

    def comparison(self) -> ProfileComparison | None:
        """
        Class-by-class comparison of the shown and the compared results over the open media.

        Returns
        -------
        ProfileComparison | None
            ``None`` unless a profile is shown and another is compared.
        """
        shown: ResultCatalog | None = self.shown_catalog()
        compared: ResultCatalog | None = self.compared_catalog()
        if shown is None or compared is None:
            return None
        return ProfileComparison.between(shown, compared, self.recognized_keys(shown), self._workbench.class_names)

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
        collection: MediaCollection = MediaCollection.gather(paths, self._media)
        if collection.is_empty:
            self._inform(collection.describe("No new images or videos found"))
            return
        added: list[MediaItem] = []
        unreadable: list[str] = []
        for path in collection.media_paths:
            try:
                added.append(MediaItem.open(path))
            except (OSError, ValueError) as error:
                unreadable.append(f"{path.name} ({error})")
        for item in added:
            self._media[item.path] = item
        if added and (is_first_shown or self._current_key is None):
            self._current_key = added[0].key_at(0)
            self._summary = ""
        video_count: int = sum(1 for item in added if item.is_video)
        image_count: int = len(added) - video_count
        parts: list[str] = []
        if image_count:
            parts.append(f"{image_count} image{'' if image_count == 1 else 's'}")
        if video_count:
            parts.append(f"{video_count} video{'' if video_count == 1 else 's'}")
        headline: str = f"Added {' and '.join(parts)}" if parts else "Added nothing"
        if unreadable:
            headline = f"{headline}; could not open {', '.join(unreadable)}"
        self._inform(collection.describe(headline))
        self._save_session()
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        self._resume_background()

    def restore_session(self) -> None:
        """
        Open the media of the last session again and show the picture shown then; missing files are skipped.
        """
        session: Session = self._stores.session_store.load()
        existing: list[Path] = [path for path in session.media_paths if path.is_file()]
        missing_count: int = len(session.media_paths) - len(existing)
        if not existing:
            if missing_count:
                self._inform(f"None of the {missing_count} files of the last session exist any more.")
            return
        self.open_paths(existing)
        if session.current_path is not None and session.current_path in self._media:
            self.show(session.current_path, session.current_frame_index)
        missing_note: str = f" ({missing_count} missing skipped)" if missing_count else ""
        self._inform(
            f"Restored {len(existing)} file{'' if len(existing) == 1 else 's'} of the last session{missing_note}."
        )

    def close_media(self, paths: Iterable[Path]) -> None:
        """
        Close files, keeping their stored results; when the shown file is closed, the next remaining one is shown.

        Parameters
        ----------
        paths : Iterable[Path]
            Open files to close; others are ignored.
        """
        closed: frozenset[Path] = frozenset(paths) & frozenset(self._media)
        if not closed:
            return
        if self._current_key is not None and self._current_key.path in closed:
            following: Path | None = self._next_remaining_path(closed)
            self._current_key = None if following is None else self._media[following].key_at(0)
            self._summary = ""
        for path in closed:
            del self._media[path]
        self._inform(f"Closed {len(closed)} file{'' if len(closed) == 1 else 's'}.")
        self._save_session()
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        self._engine.interrupt_background()
        self._resume_background()

    def show(self, path: Path, frame_index: int | None = None) -> None:
        """
        Show an open image, or a frame of an open video; it is recognized first when it has no up-to-date result.

        Parameters
        ----------
        path : Path
            Open file.
        frame_index : int | None, optional
            Frame of a video, clamped to its frames; the first frame when ``None`` and the video was not shown.

        Raises
        ------
        KeyError
            If the file is not open.
        """
        item: MediaItem = self.media_item(path)
        if frame_index is None and self._current_key is not None and self._current_key.path == path:
            frame_index = self._current_key.frame_index
        key: FrameKey = item.key_at(frame_index)
        if key == self._current_key:
            return
        is_other_media: bool = self._current_key is None or self._current_key.path != path
        self._current_key = key
        if is_other_media:
            self._summary = ""
        self._save_session()
        self._changed(WorkspaceTopic.STATE)
        self._prioritize_shown()

    def set_sampling(self, frame_step: int) -> None:
        """
        Recognize every ``frame_step``-th frame of videos; results of other frames are kept.

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
        if sampling == self._sampling:
            return
        self._sampling = sampling
        self._save_session()
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        self._engine.interrupt_background()
        self._resume_background()

    def set_background_scope(self, scope: BackgroundScope) -> None:
        """
        Choose what is recognized in the background.

        Parameters
        ----------
        scope : BackgroundScope
            New scope.
        """
        self._background_scope = scope
        self._save_session()
        self._changed(WorkspaceTopic.STATE)
        if scope is BackgroundScope.OFF:
            self._engine.interrupt_background()
        else:
            self._resume_background()

    def select_task(self, task: RecognitionTask) -> None:
        """
        Switch to another task; its model, results and class minimums are shown.

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
        if task not in self._model_selector.tasks:
            raise ValueError(f"No {task.value} models are available.")
        if task is self._task:
            return
        self._task = task
        self._compared_profile = None
        self._summary = ""
        self._planner.unpin()
        self._show_profile_of_task()
        self._save_session()
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        self._engine.interrupt_background()
        self._resume_background()

    def select_model(self, selection: ModelSelection) -> None:
        """
        Choose the model and options of the current task used by the next recognitions.

        Parameters
        ----------
        selection : ModelSelection
            Preset of the current task and overrides.

        Raises
        ------
        KeyError
            If the preset does not exist.
        ValueError
            If a foreground job runs, the preset belongs to another task, or the device or an option is not available.
        """
        if self.is_busy:
            raise ValueError("The model cannot be changed while an inference is running.")
        if selection.task is not self._task:
            raise ValueError(f"A {selection.task.value} model cannot be chosen while the task is {self._task.value}.")
        validated: ModelSelection = self._model_selector.validated(selection)
        self._model_selector.model_of(validated)
        self._selections[validated.task] = validated
        self._planner.unpin()
        self._planner.resume()
        self._save_session()
        self._changed(WorkspaceTopic.STATE)
        self._engine.interrupt_background()
        self._resume_background()

    def select_preset(self, backend: str, preset_name: str) -> None:
        """
        Choose a preset of the current task with its own values.

        Parameters
        ----------
        backend : str
            Model family.
        preset_name : str
            Preset name.

        Raises
        ------
        KeyError
            If the preset does not exist.
        ValueError
            If a foreground job runs.
        """
        self.select_model(self._model_selector.selection_of(self._task, backend, preset_name))

    def edit_classes(self, edit: Callable[[ClassWorkbench], object]) -> None:
        """
        Change the classes, phrases or reference images, then remember them and recognize outdated pictures again.

        Parameters
        ----------
        edit : Callable[[ClassWorkbench], object]
            Edit applied to the workbench; an error it raises is passed on and nothing else happens.
        """
        edit(self._workbench)
        try:
            self._stores.class_list_store.save(self._workbench.classes)
        except OSError as error:
            self._inform(f"Could not remember the classes: {error}")
        self._planner.forget_failures()
        self._planner.resume()
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS, WorkspaceTopic.CLASS_SETS)
        self._engine.interrupt_background()
        self._resume_background()

    def edit_class_sets(self, edit: Callable[[ClassWorkbench], object]) -> None:
        """
        Change the saved class sets without changing the classes.

        Parameters
        ----------
        edit : Callable[[ClassWorkbench], object]
            Edit applied to the workbench; an error it raises is passed on.
        """
        edit(self._workbench)
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.CLASS_SETS)

    def edit_picture_prompts(self, frame_key: FrameKey, edit: Callable[[PicturePromptBoard], object]) -> None:
        """
        Change the exemplar boxes or object marks drawn on a picture, remember them, and recognize the shown picture
        again when the chosen model reads them there.

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
        try:
            self._stores.picture_prompt_store.save(self._workbench.picture_board.prompts)
        except OSError as error:
            self._inform(f"Could not remember the drawings: {error}")
        model: RecognitionModel = self.current_model()
        is_drawing_read: bool = any(kind.is_drawn_on_picture for kind in model.supported_query_kinds)
        if is_drawing_read and not model.is_sequential and frame_key == self._current_key:
            self._requested_key = frame_key
            self._planner.unpin()
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        self._engine.interrupt_background()
        self._resume_background()

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
        if self._current_key is None:
            return self._reject("Open an image or a video first.")
        return self._start(JobPurpose.RUN_CURRENT, (self._current_key,), is_skipping_approved)

    def run_media(self, is_skipping_approved: bool, start_frame: int | None = None) -> ActionReply:
        """
        Recognize every sampled frame of the shown video (or the shown image) lacking an up-to-date result.

        Parameters
        ----------
        is_skipping_approved : bool
            Whether the user approved leaving out classes the model cannot query.
        start_frame : int | None, optional
            Frame of the video recognized first, so results arrive ahead of playback from there; the frames before it
            follow. From the first frame when absent.

        Returns
        -------
        ActionReply
            Started, refused, or waiting for approval.
        """
        item: MediaItem | None = self.current_item
        if item is None:
            return self._reject("Open an image or a video first.")
        pending: tuple[FrameKey, ...] = self._pending_keys(self.current_model().profile(), (item,))
        if not pending:
            return self._reject(f"Every sampled picture of {item.path.name} is up to date.")
        if start_frame is not None:
            pending = tuple(
                sorted(pending, key=lambda key: key.frame_index is not None and key.frame_index < start_frame)
            )
        return self._start(JobPurpose.RUN_MEDIA, pending, is_skipping_approved)

    def run_all(self, is_skipping_approved: bool) -> ActionReply:
        """
        Recognize every picture of the open media lacking an up-to-date result of the chosen model.

        Parameters
        ----------
        is_skipping_approved : bool
            Whether the user approved leaving out classes the model cannot query.

        Returns
        -------
        ActionReply
            Started, refused, or waiting for approval.
        """
        if not self._media:
            return self._reject("Open images or videos first.")
        pending: tuple[FrameKey, ...] = self._pending_keys(self.current_model().profile(), self.media)
        if not pending:
            return self._reject("Every picture is up to date with the chosen model.")
        return self._start(JobPurpose.RUN_ALL, pending, is_skipping_approved)

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
        catalog: ResultCatalog | None = self.shown_catalog()
        profile: ModelProfile | None = self._shown_profile
        if catalog is None or profile is None:
            return self._reject("No results are shown.")
        outdated: tuple[FrameKey, ...] = tuple(
            self._library.outdated_keys(profile, self.signature_for(profile), self.recognized_keys(catalog))
        )
        if not outdated:
            return self._reject("No outdated pictures to update.")
        if profile != self.current_model().profile():
            return self._reject(
                f"The outdated pictures were inferred with {profile.label} ({profile.options_text}); "
                + "choose these model settings to update them."
            )
        return self._start(JobPurpose.UPDATE_OUTDATED, outdated, is_skipping_approved)

    def cancel(self) -> None:
        """
        Ask the foreground job, if any, to stop after its current mini-batch.
        """
        self._engine.cancel()

    def export_plan(self) -> ExportPlan:
        """
        What an export would write now.

        Returns
        -------
        ExportPlan
            Profile, counts and why the export cannot start, if it cannot.
        """
        profile: ModelProfile = self._shown_profile or self.current_model().profile()
        pending: tuple[FrameKey, ...] = self._pending_keys(profile, self.media)
        catalog: ResultCatalog | None = self._library.catalog_of(profile) if profile in self._library else None
        picture_count: int = 0 if catalog is None else len(self.recognized_keys(catalog))
        issue: str = ""
        if not self._media:
            issue = "Open images or videos first."
        elif self.is_busy:
            issue = "An inference is already running."
        elif pending and profile != self.current_model().profile():
            issue = (
                f"{len(pending)} pictures have no up-to-date result of {profile.label} ({profile.options_text}); "
                + "choose these model settings to run inference on them before exporting."
            )
        return ExportPlan(
            profile=profile,
            picture_count=picture_count + sum(1 for key in pending if catalog is None or key not in catalog),
            pending_count=len(pending),
            issue=issue,
        )

    def export(self, request: ExportRequest, is_skipping_approved: bool) -> ActionReply:
        """
        Write the stored results of the shown profile, recognizing the pictures without an up-to-date result first.

        Parameters
        ----------
        request : ExportRequest
            Options chosen by the user.
        is_skipping_approved : bool
            Whether the user approved leaving out classes the model cannot query.

        Returns
        -------
        ActionReply
            Started, refused, or waiting for approval.
        """
        plan: ExportPlan = self.export_plan()
        if plan.issue:
            return self._reject(plan.issue)
        if request.options.scope is ExportScope.LISTED and plan.pending_count:
            return self._reject(
                f"Only listed findings can be exported once inference has run on every picture; {plan.pending_count} "
                + "pictures have no up-to-date result. Run All first, or export every kept finding."
            )
        if not plan.pending_count:
            self._write_export(plan.profile, request)
            return ActionReply.done()
        self._pending_export = request
        reply: ActionReply = self._start(
            JobPurpose.EXPORT, self._pending_keys(plan.profile, self.media), is_skipping_approved
        )
        if reply.status is not ActionStatus.DONE:
            self._pending_export = None
        return reply

    def select_profile(self, profile: ModelProfile) -> None:
        """
        Show the results of a stored profile; the background keeps away while it differs from the chosen model.

        Parameters
        ----------
        profile : ModelProfile
            Stored profile.

        Raises
        ------
        KeyError
            If the profile is not stored.
        """
        self._library.catalog_of(profile)
        if profile.task is not self._task:
            self._task = profile.task
        if profile == self.current_model().profile():
            self._planner.unpin()
        else:
            self._planner.pin()
            self._engine.interrupt_background()
        self._display_profile(profile)
        self._resume_background()

    def remove_profiles(self, profiles: tuple[ModelProfile, ...]) -> None:
        """
        Forget the results of several profiles at once.

        Parameters
        ----------
        profiles : tuple[ModelProfile, ...]
            Profiles to forget; those that are not stored are skipped.
        """
        if not profiles:
            return
        for profile in profiles:
            self._library.remove(profile)
        self._schedule_save()
        if self._compared_profile in profiles:
            self._compared_profile = None
        if self._shown_profile in profiles:
            remaining: tuple[ModelProfile, ...] = self.task_profiles()
            self._display_profile(remaining[-1] if remaining else None)
            self._planner.unpin()
            self._resume_background()
            return
        self._changed(WorkspaceTopic.STATE)

    def clear_results(self) -> None:
        """
        Forget every stored result of the current task.
        """
        for profile in self.task_profiles():
            self._library.remove(profile)
        self._compared_profile = None
        self._planner.unpin()
        self._display_profile(None)
        self._schedule_save()
        self._resume_background()

    def compare_with(self, profile: ModelProfile | None) -> None:
        """
        Compare the shown results with another stored profile of the task, or stop comparing.

        Parameters
        ----------
        profile : ModelProfile | None
            Stored profile other than the shown one; ``None`` stops comparing.
        """
        is_comparable: bool = (
            profile is not None
            and profile in self._library
            and profile != self._shown_profile
            and profile.task is self._task
        )
        self._compared_profile = profile if is_comparable else None
        self._changed(WorkspaceTopic.STATE)

    def set_accepted(self, findings: Mapping[FrameKey, Iterable[int]], is_accepted: bool) -> None:
        """
        Keep or reject findings of the shown results.

        Parameters
        ----------
        findings : Mapping[FrameKey, Iterable[int]]
            Finding indices per picture.
        is_accepted : bool
            True to keep them, False to reject them.

        Raises
        ------
        KeyError
            If no results are shown or a picture has not been recognized.
        IndexError
            If an index is outside the findings of its picture.
        """
        catalog: ResultCatalog | None = self.shown_catalog()
        if catalog is None:
            raise KeyError("No results are shown.")
        for frame_key, indices in findings.items():
            catalog.set_accepted(frame_key, indices, is_accepted)
        self._schedule_save()
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def set_class_thresholds(self, class_thresholds: ClassThresholds) -> None:
        """
        Change the minimum confidence of the classes for the current task and remember it.

        Parameters
        ----------
        class_thresholds : ClassThresholds
            Default and per-class minimums.
        """
        self._thresholds[self._task] = class_thresholds
        try:
            self._stores.class_threshold_store.save(self._thresholds)
        except OSError as error:
            self._inform(f"Could not save the class minimums: {error}")
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def set_duplicate_suppression(self, suppression: DuplicateSuppression) -> None:
        """
        Change the review suppression of overlapping boxes for the current task and remember it.

        Parameters
        ----------
        suppression : DuplicateSuppression
            Whether it runs and its overlaps.
        """
        self._suppressions[self._task] = suppression
        try:
            self._stores.duplicate_suppression_store.save(self._suppressions)
        except OSError as error:
            self._inform(f"Could not save the duplicate suppression: {error}")
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def save_results(self) -> None:
        """
        Write the stored results to the data directory soon, off the owning thread.
        """
        self._results_save.save_soon()

    def save_now(self) -> None:
        """
        Write the results and the session at once on the calling thread, e.g. when the application quits.
        """
        try:
            self._results_save.save_now()
        except OSError as error:
            self._inform(f"Could not save the results: {error}")
        self._save_session()

    def stop_inference(self) -> None:
        """
        Cancel every job and ask the worker to quit after the current mini-batch, without waiting.
        """
        self._engine.stop()

    def join_inference(self) -> None:
        """
        Wait until the worker has quit; the only method safe to call from a thread other than the owner.
        """
        self._engine.join()

    def on_busy_changed(self, is_busy: bool) -> None:
        """
        Follow the foreground jobs of the engine.

        Parameters
        ----------
        is_busy : bool
            Whether a foreground job is requested or running.
        """
        if not is_busy:
            self._progress = None
            self._clear_activity_when_idle()
        self._changed(WorkspaceTopic.STATE)

    def on_activity(self, message: str) -> None:
        """
        Show what the worker is doing.

        Parameters
        ----------
        message : str
            Progress message.
        """
        self._activity_message = message
        self._changed(WorkspaceTopic.STATE)

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
        self._schedule_save()
        if self._current_key in frame_keys:
            self._summarize(job, outcome, frame_keys)
        if profile == self._shown_profile and any(key.path in self._media for key in frame_keys):
            self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
        else:
            self._changed(WorkspaceTopic.STATE)

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
        self._progress = RunProgress(
            title=job.purpose.title,
            processed_count=job.control.processed_count,
            total_count=len(job.frame_keys),
            is_blocking=job.purpose.is_blocking,
        )
        self._changed(WorkspaceTopic.STATE)

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
                self._inform(
                    f"Done{unreadable_note}." if summary.recognized_count else f"Nothing inferred{unreadable_note}."
                )
            case JobPurpose.RUN_MEDIA | JobPurpose.RUN_ALL | JobPurpose.UPDATE_OUTDATED:
                verb: str = "stopped after" if summary.is_cancelled else "inferred"
                self._inform(f"{job.purpose.title} {verb} {summary.recognized_count} pictures{unreadable_note}.")
            case JobPurpose.EXPORT:
                request: ExportRequest | None = self._pending_export
                self._pending_export = None
                if summary.is_cancelled:
                    self._inform(f"Export cancelled after {summary.recognized_count} pictures.")
                elif request is not None:
                    self._write_export(job.profile, request)
        self._clear_activity_when_idle()
        self._changed(WorkspaceTopic.STATE)
        self._detect_in_background()

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
            self._pending_export = None
        if job.purpose.is_foreground:
            self._alert(f"{job.purpose.title} failed", message)
        else:
            self._planner.pause()
            self._inform(f"Background inference paused: {message}")
        self._changed(WorkspaceTopic.STATE)
        self._detect_in_background()

    def _selection_of(self, task: RecognitionTask) -> ModelSelection:
        if task not in self._selections:
            self._selections[task] = self._model_selector.default_selection(task)
        return self._selections[task]

    def _apply_stored_settings(self, session: Session) -> None:
        for task, selection in session.selections.items():
            try:
                validated: ModelSelection = self._model_selector.validated(selection)
                self._model_selector.model_of(validated)
            except (KeyError, ValueError, TypeError):
                continue
            self._selections[task] = validated
        if session.task is not None and session.task in self._model_selector.tasks:
            self._task = session.task
        if session.frame_step is not None and session.frame_step > 0:
            self._sampling = VideoSampling(session.frame_step)
        if session.background_scope is not None:
            try:
                self._background_scope = BackgroundScope(session.background_scope)
            except ValueError:
                pass

    def _show_profile_of_task(self) -> None:
        profiles: tuple[ModelProfile, ...] = self.task_profiles()
        if not profiles:
            self._shown_profile = None
            return
        current: ModelProfile = self.current_model().profile()
        self._shown_profile = current if current in profiles else profiles[-1]

    def _up_to_date_check(self, profile: ModelProfile | None) -> Callable[[FrameKey], bool]:
        if profile is None or profile not in self._library:
            return lambda frame_key: False
        catalog: ResultCatalog = self._library.catalog_of(profile)
        current_of: Callable[[FrameKey], PromptSignature] = self.signature_for(profile)

        def is_up_to_date(frame_key: FrameKey) -> bool:
            if frame_key not in catalog:
                return False
            change: PromptChange | None = catalog.prompt_change_of(
                frame_key, current_of(frame_key).for_query_kinds(profile.query_kinds)
            )
            return change is not None and change.is_unchanged

        return is_up_to_date

    def _settled_check(self, profile: ModelProfile) -> Callable[[FrameKey], bool]:
        is_up_to_date: Callable[[FrameKey], bool] = self._up_to_date_check(profile)
        if QueryKind.MARK not in profile.query_kinds:
            return is_up_to_date
        prompts: PicturePrompts = self._workbench.picture_board.prompts
        catalog: ResultCatalog | None = self._library.catalog_of(profile) if profile in self._library else None

        def is_settled(frame_key: FrameKey) -> bool:
            if is_up_to_date(frame_key):
                return True
            is_marked: bool = bool(prompts.relevant_to(frame_key, profile.is_sequential).marks)
            return not is_marked and (catalog is None or frame_key not in catalog)

        return is_settled

    def _pending_keys(self, profile: ModelProfile, media: Iterable[MediaItem]) -> tuple[FrameKey, ...]:
        is_settled: Callable[[FrameKey], bool] = self._settled_check(profile)
        return tuple(key for item in media for key in self.expected_keys(item) if not is_settled(key))

    def _changed(self, *topics: WorkspaceTopic) -> None:
        changed_topics: frozenset[WorkspaceTopic] = frozenset(topics)
        for observer in tuple(self._observers):
            observer.on_changed(changed_topics)

    def _inform(self, message: str) -> None:
        self._status_message = message
        self._status_serial += 1
        self._changed(WorkspaceTopic.STATE)

    def _alert(self, title: str, message: str) -> None:
        self._inform(f"{title}.")
        notice: Notice = Notice.error(title, message)
        for observer in tuple(self._observers):
            observer.on_notice(notice)

    def _reject(self, message: str) -> ActionReply:
        self._inform(message)
        return ActionReply.rejected(message)

    def _clear_activity_when_idle(self) -> None:
        if self._engine.is_idle:
            self._activity_message = ""

    def _load_results(self) -> ResultLibrary:
        try:
            return self._stores.results_store.load()
        except (OSError, ValueError) as error:
            self._status_message = f"Could not restore the saved results: {error}"
            return ResultLibrary()

    def _next_remaining_path(self, closed: frozenset[Path]) -> Path | None:
        if self._current_key is None:
            return None
        paths: list[Path] = list(self._media)
        index: int = paths.index(self._current_key.path)
        following: list[Path] = [path for path in paths[index:] if path not in closed]
        preceding: list[Path] = [path for path in paths[:index] if path not in closed]
        if following:
            return following[0]
        return preceding[-1] if preceding else None

    def _save_session(self) -> None:
        try:
            self._stores.session_store.save(
                Session(
                    media_paths=tuple(self._media),
                    current_path=None if self._current_key is None else self._current_key.path,
                    current_frame_index=None if self._current_key is None else self._current_key.frame_index,
                    task=self._task,
                    frame_step=self._sampling.frame_step,
                    background_scope=self._background_scope.value,
                    selections=dict(self._selections),
                )
            )
        except OSError as error:
            self._inform(f"Could not save the session: {error}")

    def _schedule_save(self) -> None:
        self._results_save.schedule()

    def _prioritize_shown(self) -> None:
        job: InferenceJob | None = self._engine.running_job
        current: FrameKey | None = self._current_key
        if job is not None and not job.purpose.is_foreground and current is not None:
            upcoming: tuple[FrameKey, ...] = job.remaining_keys[: job.model.batch_size * 2]
            is_current_pending: bool = not self._up_to_date_check(job.profile)(current)
            is_expected: bool = current in self.expected_keys(self._media[current.path])
            if is_current_pending and is_expected and current not in upcoming:
                self._engine.interrupt_background()
        self._resume_background()

    def _resume_background(self) -> None:
        self._planner.resume()
        self._detect_in_background()

    def _detect_in_background(self) -> None:
        if self._is_exporting or self.is_busy or not self._engine.is_idle:
            return
        model: RecognitionModel = self.current_model()
        if self._current_key is None or (model.prompt_mode.is_class_list_needed and not self._workbench.classes):
            return
        profile: ModelProfile = model.profile()
        is_settled: Callable[[FrameKey], bool] = self._settled_check(profile)
        keys: tuple[FrameKey, ...] = self._requested_keys(profile, is_settled) or self._planner.next_keys(
            profile,
            self._background_scope,
            self._current_key,
            self.media,
            is_settled,
        )
        if not keys:
            return
        prompt: LabeledPrompt | None = self._background_prompt(model)
        if prompt is None:
            return
        job: InferenceJob = InferenceJob(
            purpose=JobPurpose.BACKGROUND, model=model, prompt=prompt, frame_keys=keys, media=dict(self._media)
        )
        if self._engine.submit(job):
            self._switch_to(profile)

    def _prepare_prompt(self, model: RecognitionModel, is_skipping_approved: bool) -> PromptPreparation:
        match model.prompt_mode:
            case PromptMode.MARKS | PromptMode.AUTOMATIC:
                return PromptPreparation(prompt=self._labeled_prompt(model, ()))
            case PromptMode.CLASSES:
                pass
        supported_kinds: frozenset[QueryKind] = model.supported_query_kinds
        exemplar_names: frozenset[str] = self._exemplar_class_names()
        definitions: tuple[ClassDefinition, ...] = self._workbench.classes
        board: ReferenceBoard = self._workbench.reference_board
        skipped_names: tuple[str, ...] = board.reference_only_classes(definitions, supported_kinds, exemplar_names)
        if skipped_names and len(skipped_names) < len(definitions):
            if frozenset(skipped_names) != self._approved_skipped_classes:
                if not is_skipping_approved:
                    return PromptPreparation(prompt=None, unapproved_class_names=skipped_names)
                self._approved_skipped_classes = frozenset(skipped_names)
            definitions = tuple(definition for definition in definitions if definition.name not in skipped_names)
        issue: str | None = board.prompt_issue(definitions, supported_kinds, exemplar_names)
        if issue is not None:
            return PromptPreparation(prompt=None, issue=issue)
        return PromptPreparation(
            prompt=self._labeled_prompt(model, board.build_classes(definitions, supported_kinds, exemplar_names))
        )

    def _background_prompt(self, model: RecognitionModel) -> LabeledPrompt | None:
        match model.prompt_mode:
            case PromptMode.MARKS | PromptMode.AUTOMATIC:
                return self._labeled_prompt(model, ())
            case PromptMode.CLASSES:
                pass
        supported_kinds: frozenset[QueryKind] = model.supported_query_kinds
        exemplar_names: frozenset[str] = self._exemplar_class_names()
        definitions: tuple[ClassDefinition, ...] = self._workbench.classes
        board: ReferenceBoard = self._workbench.reference_board
        skipped_names: tuple[str, ...] = board.reference_only_classes(definitions, supported_kinds, exemplar_names)
        if skipped_names and frozenset(skipped_names) != self._approved_skipped_classes:
            return None
        kept: tuple[ClassDefinition, ...] = tuple(
            definition for definition in definitions if definition.name not in skipped_names
        )
        if board.prompt_issue(kept, supported_kinds, exemplar_names) is not None:
            return None
        return self._labeled_prompt(model, board.build_classes(kept, supported_kinds, exemplar_names))

    def _labeled_prompt(self, model: RecognitionModel, classes: tuple[PromptClass, ...]) -> LabeledPrompt:
        return LabeledPrompt(
            classes=classes,
            class_signature=self._workbench.reference_board.signature_of(self._workbench.classes),
            query_kinds=model.supported_query_kinds,
            picture_prompts=self._workbench.picture_board.prompts.restricted_to(self._media),
            is_sequential=model.is_sequential,
        )

    def _exemplar_class_names(self) -> frozenset[str]:
        return frozenset(box.class_name for box in self._workbench.picture_board.prompts.exemplars if box.is_positive)

    def _requested_keys(self, profile: ModelProfile, is_settled: Callable[[FrameKey], bool]) -> tuple[FrameKey, ...]:
        requested: FrameKey | None = self._requested_key
        self._requested_key = None
        if requested is None or requested.path not in self._media or self._planner.is_paused:
            return ()
        return () if is_settled(requested) else (requested,)

    def _sequential_keys(self, frame_keys: tuple[FrameKey, ...]) -> tuple[FrameKey, ...]:
        prompts: PicturePrompts = self._workbench.picture_board.prompts
        ordered: list[FrameKey] = []
        for path in dict.fromkeys(key.path for key in frame_keys):
            item: MediaItem = self._media[path]
            if not item.is_video:
                ordered.append(item.key_at(None))
                continue
            keys: set[FrameKey] = {*self.expected_keys(item), *prompts.marked_keys(path)}
            keys.update(key for key in frame_keys if key.path == path)
            ordered.extend(sorted(keys, key=lambda key: key.sort_key()))
        return tuple(ordered)

    def _start(self, purpose: JobPurpose, frame_keys: tuple[FrameKey, ...], is_skipping_approved: bool) -> ActionReply:
        if self.is_busy:
            return self._reject("An inference is already running.")
        model: RecognitionModel = self.current_model()
        if model.prompt_mode.is_class_list_needed and not self._workbench.classes:
            return self._reject("Add at least one class before running inference.")
        if model.is_sequential:
            frame_keys = self._sequential_keys(frame_keys)
        if model.prompt_mode is PromptMode.MARKS and not any(
            self._workbench.picture_board.prompts.relevant_to(key, model.is_sequential).marks for key in frame_keys
        ):
            return self._reject(
                f"{model.preset.label} segments the objects you mark: choose a class, then click on an object or "
                + "drag a box around it in the viewer."
            )
        preparation: PromptPreparation = self._prepare_prompt(model, is_skipping_approved)
        if preparation.prompt is None:
            if preparation.unapproved_class_names:
                listed: str = ", ".join(preparation.unapproved_class_names)
                return ActionReply(
                    status=ActionStatus.NEEDS_APPROVAL,
                    message=f"{model.preset.label} does not take reference images, so these classes have no usable "
                    + f"query: {listed}. Run inference on the other classes without them?",
                    skipped_class_names=preparation.unapproved_class_names,
                )
            return self._reject(preparation.issue)
        job: InferenceJob = InferenceJob(
            purpose=purpose, model=model, prompt=preparation.prompt, frame_keys=frame_keys, media=dict(self._media)
        )
        self._planner.unpin()
        self._planner.resume()
        self._switch_to(job.profile)
        self._progress = RunProgress(
            title=purpose.title, processed_count=0, total_count=len(frame_keys), is_blocking=purpose.is_blocking
        )
        self._engine.submit(job)
        return ActionReply.done()

    def _summarize(self, job: InferenceJob, outcome: RecognitionOutcome, frame_keys: tuple[FrameKey, ...]) -> None:
        if self._current_key is None:
            return
        result: FrameResult = outcome.results[frame_keys.index(self._current_key)]
        load_note: str = " (model loaded)" if outcome.is_model_reloaded else ""
        per_picture_ms: float = outcome.inference_seconds * 1000 / max(1, len(frame_keys))
        self._summary = (
            f"{job.model.preset.label} | {job.model.weights_path} | {job.prompt.description} | "
            + f"{len(result.findings)} {job.model.task.finding_noun}s | {per_picture_ms:.0f} ms/picture{load_note}"
        )

    def _switch_to(self, profile: ModelProfile) -> None:
        self._library.add(profile)
        if profile != self._shown_profile:
            self._display_profile(profile)

    def _display_profile(self, profile: ModelProfile | None) -> None:
        self._shown_profile = profile
        if self._compared_profile == profile:
            self._compared_profile = None
        self._summary = ""
        self._changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def _review_filter_of(self, task: RecognitionTask) -> ReviewFilter:
        return ReviewFilter(
            self._thresholds.get(task, ClassThresholds()), self._suppressions.get(task, DuplicateSuppression())
        )

    def _write_export(self, profile: ModelProfile, request: ExportRequest) -> None:
        if profile not in self._library:
            self._inform("Nothing to export.")
            return
        catalog: ResultCatalog = self._library.catalog_of(profile)
        selection: ExportSelection = ExportSelection(
            review_filter=self._review_filter_of(profile.task),
            minimum_confidence=request.options.minimum_confidence,
            listed_indices=(
                request.listed_indices
                if request.options.scope is ExportScope.LISTED and profile == self._shown_profile
                else None
            ),
        )
        items: list[ExportItem] = []
        for frame_key in self.recognized_keys(catalog):
            stored: StoredResult | None = catalog.stored_of(frame_key)
            if stored is None:
                continue
            result, label = selection.selected(frame_key, stored)
            item: MediaItem = self._media[frame_key.path]
            seconds: float | None = (
                None
                if item.video is None or frame_key.frame_index is None
                else item.video.seconds_of(frame_key.frame_index)
            )
            items.append(ExportItem(frame_key=frame_key, result=result, label=label, seconds=seconds))
        exporter: ResultExporter = ResultExporter(self._media, self.class_colors(), request.is_label_confidence_shown)
        class_names: tuple[str, ...] = self._workbench.class_names
        self._is_exporting = True
        self._activity_message = f"Writing {request.options.export_format.label} ..."
        self._changed(WorkspaceTopic.STATE)
        self._scheduler.run_blocking(
            lambda: exporter.write(items, profile.task, request.options, class_names),
            self._on_export_written,
            self._on_export_failed,
        )

    def _on_playback_prepared(self, path: Path) -> None:
        self._preparing_playback_paths.discard(path)
        self._inform(f"Prepared a playable copy of {path.name}.")

    def _on_playback_failed(self, path: Path, error: Exception) -> None:
        self._preparing_playback_paths.discard(path)
        self._failed_playback_paths.add(path)
        self._alert(f"Could not prepare a playable copy of {path.name}", str(error))

    def _on_export_written(self, report: ExportReport) -> None:
        self._is_exporting = False
        self._last_export = report
        self._clear_activity_when_idle()
        annotated_note: str = "" if report.annotated_count is None else f", {report.annotated_count} annotated"
        self._inform(
            f"Exported {report.format_name}: {report.picture_count} pictures, {report.finding_count} findings, "
            + f"{report.file_count} files{annotated_note} to {report.output_directory}."
        )
        self._resume_background()

    def _on_export_failed(self, error: Exception) -> None:
        self._is_exporting = False
        self._clear_activity_when_idle()
        self._alert("Export failed", str(error))
        self._resume_background()

    @staticmethod
    def default_export_directory(working_directory: Path) -> Path:
        """
        Directory an export writes to unless the user chooses another.

        Parameters
        ----------
        working_directory : Path
            Directory the application was started in.

        Returns
        -------
        Path
            ``exports/<timestamp>`` under the working directory.
        """
        return working_directory / "exports" / datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
