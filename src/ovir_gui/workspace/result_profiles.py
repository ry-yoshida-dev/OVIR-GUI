from collections.abc import Callable, Iterable, Mapping

from ..media import FrameKey
from ..models import ModelProfile, RecognitionModel
from ..results import ResultCatalog, ResultLibrary
from ..storage import ResultsSnapshot
from .background_planner import BackgroundPlanner
from .deferred_save import DeferredSave
from .recognition_settings import RecognitionSettings
from .result_read_model import ResultReadModel
from .status_notifier import StatusNotifier
from .working_state import WorkingState
from .workspace_topic import WorkspaceTopic


class ResultProfiles:
    """
    Which stored profile is shown and compared, and the user's review of its findings.

    Showing a profile other than the chosen model's keeps the background away from it until the user runs that model
    again. Results are saved shortly after every change.
    """

    def __init__(
        self,
        working: WorkingState,
        settings: RecognitionSettings,
        library: ResultLibrary,
        read_model: ResultReadModel,
        planner: BackgroundPlanner,
        notifier: StatusNotifier,
        results_save: DeferredSave[ResultsSnapshot],
        current_model: Callable[[], RecognitionModel],
        interrupt_background: Callable[[], None],
        resume_background: Callable[[], None],
    ) -> None:
        """
        Parameters
        ----------
        working : WorkingState
            Shown and compared profiles.
        settings : RecognitionSettings
            Current task.
        library : ResultLibrary
            Stored results of every profile.
        read_model : ResultReadModel
            Profiles of the current task and the shown catalog.
        planner : BackgroundPlanner
            Background kept away from a shown profile other than the chosen model's.
        notifier : StatusNotifier
            Views told about changes.
        results_save : DeferredSave[ResultsSnapshot]
            Save of the results after every change.
        current_model : Callable[[], RecognitionModel]
            Model chosen for the current task.
        interrupt_background : Callable[[], None]
            Asks a running background job to yield.
        resume_background : Callable[[], None]
            Resumes the background and starts its next job.
        """
        self._working: WorkingState = working
        self._settings: RecognitionSettings = settings
        self._library: ResultLibrary = library
        self._read_model: ResultReadModel = read_model
        self._planner: BackgroundPlanner = planner
        self._notifier: StatusNotifier = notifier
        self._results_save: DeferredSave[ResultsSnapshot] = results_save
        self._current_model: Callable[[], RecognitionModel] = current_model
        self._interrupt_background: Callable[[], None] = interrupt_background
        self._resume_background: Callable[[], None] = resume_background

    def select(self, profile: ModelProfile) -> None:
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
        if profile.task is not self._settings.task:
            self._settings.task = profile.task
        if profile == self._current_model().profile():
            self._planner.unpin()
        else:
            self._planner.pin()
            self._interrupt_background()
        self.display(profile)
        self._resume_background()

    def remove(self, profiles: tuple[ModelProfile, ...]) -> None:
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
        self._results_save.schedule()
        if self._working.compared_profile in profiles:
            self._working.compared_profile = None
        if self._working.shown_profile in profiles:
            remaining: tuple[ModelProfile, ...] = self._read_model.task_profiles()
            self.display(remaining[-1] if remaining else None)
            self._planner.unpin()
            self._resume_background()
            return
        self._notifier.changed(WorkspaceTopic.STATE)

    def clear(self) -> None:
        """
        Forget every stored result of the current task.
        """
        for profile in self._read_model.task_profiles():
            self._library.remove(profile)
        self._working.compared_profile = None
        self._planner.unpin()
        self.display(None)
        self._results_save.schedule()
        self._resume_background()

    def compare_with(self, profile: ModelProfile | None) -> None:
        """
        Compare the shown results with another stored profile of the task, or stop comparing.

        Parameters
        ----------
        profile : ModelProfile | None
            Stored profile other than the shown one; ``None`` stops comparing.
        """
        self.restore_comparison(profile)
        self._notifier.changed(WorkspaceTopic.STATE)

    def restore_comparison(self, profile: ModelProfile | None) -> None:
        """
        Compare with a profile kept from before without telling the views, unless it can no longer be compared.

        Parameters
        ----------
        profile : ModelProfile | None
            Profile compared with before; one forgotten, shown or of another task stops comparing.
        """
        is_comparable: bool = (
            profile is not None
            and profile in self._library
            and profile != self._working.shown_profile
            and profile.task is self._settings.task
        )
        self._working.compared_profile = profile if is_comparable else None

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
        catalog: ResultCatalog | None = self._read_model.shown_catalog()
        if catalog is None:
            raise KeyError("No results are shown.")
        for frame_key, indices in findings.items():
            catalog.set_accepted(frame_key, indices, is_accepted)
        self._results_save.schedule()
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def show_profile_of_task(self) -> None:
        """
        Show the chosen model's results of the current task, else its latest stored profile, else nothing.
        """
        profiles: tuple[ModelProfile, ...] = self._read_model.task_profiles()
        if not profiles:
            self._working.shown_profile = None
            return
        current: ModelProfile = self._current_model().profile()
        self._working.shown_profile = current if current in profiles else profiles[-1]

    def switch_to(self, profile: ModelProfile) -> None:
        """
        Store a profile about to receive results and show it.

        Parameters
        ----------
        profile : ModelProfile
            Profile of a starting job.
        """
        self._library.add(profile)
        if profile != self._working.shown_profile:
            self.display(profile)

    def display(self, profile: ModelProfile | None) -> None:
        """
        Show the results of a profile, or none, and stop comparing it with itself.

        Parameters
        ----------
        profile : ModelProfile | None
            Profile to show; ``None`` shows no results.
        """
        self._working.shown_profile = profile
        if self._working.compared_profile == profile:
            self._working.compared_profile = None
        self._working.summary = ""
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
