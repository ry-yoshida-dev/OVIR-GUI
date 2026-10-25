from collections.abc import Callable, Mapping
from datetime import datetime
from pathlib import Path

from ..export import ExportItem, ExportReport, ExportSelection, ResultExporter
from ..media import FrameKey, MediaKind
from ..models import ModelProfile
from ..results import ResultCatalog, ResultLibrary, StoredResult
from .action_reply import ActionReply
from .class_workbench import ClassWorkbench
from .export_plan import ExportPlan
from .export_preview_source import ExportPreviewSource
from .export_request import ExportRequest
from .result_read_model import ResultReadModel
from .review_settings import ReviewSettings
from .status_notifier import StatusNotifier
from .task_scheduler import TaskScheduler
from .working_state import WorkingState
from .workspace_topic import WorkspaceTopic


class ExportCoordinator:
    """
    Plans exports of the stored results of the images or the videos and writes them off the owning thread.

    Only pictures with a stored result are written; pictures still to be inferred are counted in the plan and left out.
    While the files are written the workspace counts as busy; the last finished export is kept for downloading.
    """

    def __init__(
        self,
        scheduler: TaskScheduler,
        notifier: StatusNotifier,
        working: WorkingState,
        library: ResultLibrary,
        read_model: ResultReadModel,
        review: ReviewSettings,
        workbench: ClassWorkbench,
        is_worker_idle: Callable[[], bool],
        current_profile: Callable[[], ModelProfile],
        is_busy: Callable[[], bool],
        resume_background: Callable[[], None],
    ) -> None:
        """
        Parameters
        ----------
        scheduler : TaskScheduler
            Thread owning the workspace, running the writing elsewhere.
        notifier : StatusNotifier
            Views told about the export.
        working : WorkingState
            Open media and shown profile.
        library : ResultLibrary
            Stored results.
        read_model : ResultReadModel
            Recognized and pending pictures.
        review : ReviewSettings
            Review filter of each task.
        workbench : ClassWorkbench
            Classes naming and coloring the findings.
        is_worker_idle : Callable[[], bool]
            Whether the inference worker has nothing to do, so the activity message can be cleared.
        current_profile : Callable[[], ModelProfile]
            Profile of the chosen model, the only one able to recognize pending pictures.
        is_busy : Callable[[], bool]
            Whether a foreground job or an export runs.
        resume_background : Callable[[], None]
            Resumes background recognition once an export ended.
        """
        self._scheduler: TaskScheduler = scheduler
        self._notifier: StatusNotifier = notifier
        self._working: WorkingState = working
        self._library: ResultLibrary = library
        self._read_model: ResultReadModel = read_model
        self._review: ReviewSettings = review
        self._workbench: ClassWorkbench = workbench
        self._is_worker_idle: Callable[[], bool] = is_worker_idle
        self._current_profile: Callable[[], ModelProfile] = current_profile
        self._is_busy: Callable[[], bool] = is_busy
        self._resume_background: Callable[[], None] = resume_background
        self._is_exporting: bool = False
        self._last_export: ExportReport | None = None

    @property
    def is_exporting(self) -> bool:
        """
        Whether files are being written.

        Returns
        -------
        bool
            True from the start of writing until it ends.
        """
        return self._is_exporting

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

    @staticmethod
    def default_directory(working_directory: Path) -> Path:
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

    def plan(self, media_kind: MediaKind) -> ExportPlan:
        """
        What an export of the images or the videos of the shown profile, or of the chosen model without one, would
        write now.

        Parameters
        ----------
        media_kind : MediaKind
            Whether the images or the videos are exported.

        Returns
        -------
        ExportPlan
            Profile, counts of the media kind and why the export cannot start, if it cannot.
        """
        current_profile: ModelProfile = self._current_profile()
        profile: ModelProfile = self._working.shown_profile or current_profile
        pending: tuple[FrameKey, ...] = tuple(
            key
            for key in self._read_model.pending_keys(profile, self._working.media.values())
            if key.media_kind is media_kind
        )
        catalog: ResultCatalog | None = self._library.catalog_of(profile) if profile in self._library else None
        picture_count: int = (
            0
            if catalog is None
            else sum(1 for key in self._read_model.recognized_keys(catalog) if key.media_kind is media_kind)
        )
        issue: str = ""
        if self._is_busy():
            issue = "An inference or export is running."
        elif picture_count == 0:
            issue = "Nothing is inferred yet."
        return ExportPlan(
            profile=profile,
            media_kind=media_kind,
            picture_count=picture_count,
            pending_count=len(pending),
            is_pending_inferable=profile == current_profile,
            issue=issue,
        )

    def preview_source(
        self, media_kind: MediaKind, listed_indices: Mapping[FrameKey, frozenset[int]] | None
    ) -> ExportPreviewSource:
        """
        What a label preview of the stored results of the planned profile is written from now.

        Parameters
        ----------
        media_kind : MediaKind
            Whether the images or the videos are exported.
        listed_indices : Mapping[FrameKey, frozenset[int]] | None
            Pictures the image table lists with their listed findings; ``None`` for videos.

        Returns
        -------
        ExportPreviewSource
            Exported pictures, task, classes, shown picture and open media.
        """
        profile: ModelProfile = self.plan(media_kind).profile
        items: tuple[ExportItem, ...] = (
            tuple(self._items(profile, media_kind, listed_indices)) if profile in self._library else ()
        )
        return ExportPreviewSource(
            items=items,
            task=profile.task,
            class_names=self._workbench.class_names,
            shown_key=self._working.current_key,
            media=self._working.media,
        )

    def start(self, request: ExportRequest) -> ActionReply:
        """
        Write the stored results of the images or the videos of the shown profile.

        Parameters
        ----------
        request : ExportRequest
            Options chosen by the user.

        Returns
        -------
        ActionReply
            Started or refused.
        """
        plan: ExportPlan = self.plan(request.media_kind)
        if plan.issue:
            return self._notifier.reject(plan.issue)
        self.write(plan.profile, request, self._resume_background)
        return ActionReply.done()

    def write(self, profile: ModelProfile, request: ExportRequest, on_ended: Callable[[], None]) -> None:
        """
        Write the stored results of a profile off the owning thread.

        Parameters
        ----------
        profile : ModelProfile
            Profile whose results are written.
        request : ExportRequest
            Options chosen by the user.
        on_ended : Callable[[], None]
            Called on the owning thread once the export ended and was reported.
        """
        if profile not in self._library:
            self._notifier.inform("Nothing to export.")
            return
        items: list[ExportItem] = self._items(profile, request.media_kind, request.listed_indices)
        exporter: ResultExporter = ResultExporter(
            self._working.media, self._workbench.class_colors(), request.is_label_confidence_shown
        )
        class_names: tuple[str, ...] = self._workbench.class_names
        self._is_exporting = True
        self._notifier.show_activity(f"Writing {request.options.export_format.label} ...")
        self._notifier.changed(WorkspaceTopic.STATE)
        self._scheduler.run_blocking(
            lambda: exporter.write(items, profile.task, request.options, class_names),
            lambda report: self._on_written(report, on_ended),
            lambda error: self._on_failed(error, on_ended),
        )

    def _items(
        self,
        profile: ModelProfile,
        media_kind: MediaKind,
        listed_indices: Mapping[FrameKey, frozenset[int]] | None,
    ) -> list[ExportItem]:
        catalog: ResultCatalog = self._library.catalog_of(profile)
        selection: ExportSelection = ExportSelection(
            review_filter=self._review.filter_of(profile.task), listed_indices=listed_indices
        )
        items: list[ExportItem] = []
        for frame_key in self._read_model.recognized_keys(catalog):
            is_unlisted: bool = listed_indices is not None and frame_key not in listed_indices
            if frame_key.media_kind is not media_kind or is_unlisted:
                continue
            stored: StoredResult | None = catalog.stored_of(frame_key)
            if stored is not None:
                seconds: float | None = self._working.media[frame_key.path].seconds_at(frame_key)
                items.append(selection.item_of(frame_key, stored, seconds))
        return items

    def _on_written(self, report: ExportReport, on_ended: Callable[[], None]) -> None:
        self._is_exporting = False
        self._last_export = report
        self._clear_activity_when_idle()
        annotated_note: str = "" if report.annotated_count is None else f", {report.annotated_count} annotated"
        self._notifier.inform(
            f"Exported {report.format_name}: {report.picture_count} pictures, {report.finding_count} findings, "
            + f"{report.file_count} files{annotated_note} to {report.output_directory}."
        )
        on_ended()

    def _on_failed(self, error: Exception, on_ended: Callable[[], None]) -> None:
        self._is_exporting = False
        self._clear_activity_when_idle()
        self._notifier.alert("Export failed", str(error))
        on_ended()

    def _clear_activity_when_idle(self) -> None:
        if self._is_worker_idle():
            self._notifier.clear_activity()
