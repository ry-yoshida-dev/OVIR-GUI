from collections.abc import Callable
from datetime import datetime
from pathlib import Path

from ..export import ExportItem, ExportReport, ExportScope, ExportSelection, ResultExporter
from ..media import FrameKey
from ..models import ModelProfile
from ..results import ResultCatalog, ResultLibrary, StoredResult
from .class_workbench import ClassWorkbench
from .export_plan import ExportPlan
from .export_request import ExportRequest
from .result_read_model import ResultReadModel
from .review_settings import ReviewSettings
from .status_notifier import StatusNotifier
from .task_scheduler import TaskScheduler
from .working_state import WorkingState
from .workspace_topic import WorkspaceTopic


class ExportCoordinator:
    """
    Plans exports of the stored results and writes them off the owning thread.

    An export waiting for pictures to be recognized first is kept as the pending request until its job ends. While the
    files are written the workspace counts as busy; the last finished export is kept for downloading.
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
        """
        self._scheduler: TaskScheduler = scheduler
        self._notifier: StatusNotifier = notifier
        self._working: WorkingState = working
        self._library: ResultLibrary = library
        self._read_model: ResultReadModel = read_model
        self._review: ReviewSettings = review
        self._workbench: ClassWorkbench = workbench
        self._is_worker_idle: Callable[[], bool] = is_worker_idle
        self._is_exporting: bool = False
        self._last_export: ExportReport | None = None
        self._pending_request: ExportRequest | None = None

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

    def plan(self, profile: ModelProfile, current_profile: ModelProfile, is_busy: bool) -> ExportPlan:
        """
        What an export of a profile would write now.

        Parameters
        ----------
        profile : ModelProfile
            Profile whose results are exported.
        current_profile : ModelProfile
            Profile of the chosen model, the only one able to recognize pending pictures.
        is_busy : bool
            Whether a foreground job or an export runs.

        Returns
        -------
        ExportPlan
            Profile, counts and why the export cannot start, if it cannot.
        """
        pending: tuple[FrameKey, ...] = self._read_model.pending_keys(profile, self._working.media.values())
        catalog: ResultCatalog | None = self._library.catalog_of(profile) if profile in self._library else None
        picture_count: int = 0 if catalog is None else len(self._read_model.recognized_keys(catalog))
        issue: str = ""
        if not self._working.media:
            issue = "Open images or videos first."
        elif is_busy:
            issue = "An inference is already running."
        elif pending and profile != current_profile:
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

    def hold(self, request: ExportRequest | None) -> None:
        """
        Keep an export until the pictures it needs are recognized, or forget the kept one.

        Parameters
        ----------
        request : ExportRequest | None
            Export to write when its job ends; ``None`` forgets it.
        """
        self._pending_request = request

    def take_pending(self) -> ExportRequest | None:
        """
        Export kept for the job that just ended, forgetting it.

        Returns
        -------
        ExportRequest | None
            ``None`` when none was kept.
        """
        request: ExportRequest | None = self._pending_request
        self._pending_request = None
        return request

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
        catalog: ResultCatalog = self._library.catalog_of(profile)
        selection: ExportSelection = ExportSelection(
            review_filter=self._review.filter_of(profile.task),
            minimum_confidence=request.options.minimum_confidence,
            listed_indices=(
                request.listed_indices
                if request.options.scope is ExportScope.LISTED and profile == self._working.shown_profile
                else None
            ),
        )
        items: list[ExportItem] = []
        for frame_key in self._read_model.recognized_keys(catalog):
            stored: StoredResult | None = catalog.stored_of(frame_key)
            if stored is not None:
                seconds: float | None = self._working.media[frame_key.path].seconds_at(frame_key)
                items.append(selection.item_of(frame_key, stored, seconds))
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
