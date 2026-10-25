from collections.abc import Callable
from dataclasses import replace

from ..models import (
    LicenseConsent,
    LicensedDependency,
    ModelSelection,
    ModelSelector,
    RecognitionModel,
    StoredWeights,
    WeightsStorage,
)
from ..prompting import QueryKind
from ..recognition import RecognitionTask
from ..storage import LicenseConsentStore
from .background_planner import BackgroundPlanner
from .recognition_settings import RecognitionSettings
from .status_notifier import StatusNotifier
from .workspace_topic import WorkspaceTopic


class ModelChoice:
    """
    Model chosen for each task with its overrides, and the licenses of optional modules some models need.

    A task gets its preferred preset the first time it is chosen. A model needing a licensed module can be chosen only
    once the user accepted its license; accepted licenses are remembered in the data directory. Downloaded weights of
    the presets can be deleted from this computer, except those the chosen model loads.
    """

    def __init__(
        self,
        model_selector: ModelSelector,
        license_consent: LicenseConsent,
        license_store: LicenseConsentStore,
        weights_storage: WeightsStorage,
        settings: RecognitionSettings,
        planner: BackgroundPlanner,
        notifier: StatusNotifier,
        is_busy: Callable[[], bool],
        on_chosen: Callable[[], None],
    ) -> None:
        """
        Parameters
        ----------
        model_selector : ModelSelector
            Presets of every task and the devices of this machine.
        license_consent : LicenseConsent
            Licenses accepted by the user.
        license_store : LicenseConsentStore
            File remembering the accepted licenses.
        weights_storage : WeightsStorage
            Downloaded weights of the presets on this computer.
        settings : RecognitionSettings
            Current task and the model chosen for each task.
        planner : BackgroundPlanner
            Background resumed for a newly chosen model.
        notifier : StatusNotifier
            Views told about accepted licenses and failed saves.
        is_busy : Callable[[], bool]
            Whether a foreground job or an export runs, which keeps the model fixed.
        on_chosen : Callable[[], None]
            Saves the session, tells the views and restarts the background after a model was chosen.
        """
        self._model_selector: ModelSelector = model_selector
        self._license_consent: LicenseConsent = license_consent
        self._license_store: LicenseConsentStore = license_store
        self._weights_storage: WeightsStorage = weights_storage
        self._settings: RecognitionSettings = settings
        self._planner: BackgroundPlanner = planner
        self._notifier: StatusNotifier = notifier
        self._is_busy: Callable[[], bool] = is_busy
        self._on_chosen: Callable[[], None] = on_chosen

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
    def license_consent(self) -> LicenseConsent:
        """
        Licensed modules the user accepted, in this run or an earlier one.

        Returns
        -------
        LicenseConsent
            Consent of the workspace.
        """
        return self._license_consent

    @property
    def selection(self) -> ModelSelection:
        """
        Model chosen for the current task.

        Returns
        -------
        ModelSelection
            Preset and overrides; the preferred preset of a task not chosen before.
        """
        task: RecognitionTask = self._settings.task
        if task not in self._settings.selections:
            self._settings.selections[task] = self._model_selector.default_selection(task)
        return self._settings.selections[task]

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
        ModuleNotFoundError
            If the model needs a licensed module that is not installed.
        PermissionError
            If the model needs a licensed module whose license has not been accepted.
        """
        if self._is_busy():
            raise ValueError("The model cannot be changed while an inference is running.")
        task: RecognitionTask = self._settings.task
        if selection.task is not task:
            raise ValueError(f"A {selection.task.value} model cannot be chosen while the task is {task.value}.")
        validated: ModelSelection = self._model_selector.validated(selection)
        self._license_consent.ensure_permitted(self._model_selector.model_of(validated))
        self._settings.selections[validated.task] = validated
        self._planner.unpin()
        self._planner.resume()
        self._on_chosen()

    def select_preset(self, backend: str, preset_name: str) -> None:
        """
        Choose a preset of the current task with its own values, keeping the template combination, which scores the
        stored classifications of every model.

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
        ModuleNotFoundError
            If the model needs a licensed module that is not installed.
        PermissionError
            If the model needs a licensed module whose license has not been accepted.
        """
        self.select_model(
            replace(
                self._model_selector.selection_of(self._settings.task, backend, preset_name),
                template_combination=self.selection.template_combination,
            )
        )

    def accept_license(self, dependency: LicensedDependency) -> None:
        """
        Record that the user confirmed compliant use of a licensed module, allowing the models needing it.

        Parameters
        ----------
        dependency : LicensedDependency
            Accepted module.

        Raises
        ------
        ModuleNotFoundError
            If the module is not installed.
        """
        self._license_consent.accept(dependency)
        self._notifier.save_reporting_failure(
            lambda: self._license_store.save(self._license_consent.accepted), "Could not remember the accepted license"
        )
        self._notifier.changed(WorkspaceTopic.STATE)

    def stored_weights(self) -> tuple[StoredWeights, ...]:
        """
        Downloaded weights of the presets of the current task.

        Returns
        -------
        tuple[StoredWeights, ...]
            One entry per checkpoint on this computer, in catalog order.
        """
        return self._weights_storage.stored(self._preset_weights_paths())

    def is_weights_in_use(self, weights_path: str) -> bool:
        """
        Whether the chosen model loads a checkpoint, as its own weights or those of its box detector.

        Parameters
        ----------
        weights_path : str
            Weights path of the checkpoint.

        Returns
        -------
        bool
            True when deleting the weights would remove what the chosen model runs with.
        """
        return weights_path in self.current_model().loading_signature()

    def delete_weights(self, weights_path: str) -> None:
        """
        Delete the downloaded weights of a preset of the current task; its results are kept, and the weights are
        downloaded again when a model needing them loads.

        Parameters
        ----------
        weights_path : str
            Weights path of the preset.

        Raises
        ------
        KeyError
            If no preset of the current task uses the weights.
        ValueError
            If a foreground job runs or the chosen model loads the weights.
        FileNotFoundError
            If the weights are not on this computer.
        """
        if weights_path not in self._preset_weights_paths():
            raise KeyError(f"No model of this task uses {weights_path}.")
        if self._is_busy():
            raise ValueError("Weights cannot be deleted while an inference is running.")
        if self.is_weights_in_use(weights_path):
            raise ValueError(f"{weights_path} is used by the chosen model; choose another model to delete it.")
        self._weights_storage.delete(weights_path)

    def _preset_weights_paths(self) -> tuple[str, ...]:
        task: RecognitionTask = self._settings.task
        return tuple(
            self._model_selector.base_model(task, backend, preset.name).weights_path
            for backend in self._model_selector.backends_of(task)
            for preset in self._model_selector.presets_of(task, backend)
        )
