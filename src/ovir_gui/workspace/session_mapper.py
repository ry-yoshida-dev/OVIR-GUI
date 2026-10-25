from pathlib import Path

from ..media import FrameKey, VideoSampling
from ..models import LicenseConsent, ModelSelection, ModelSelector
from ..recognition import RecognitionTask
from ..storage import Session, SessionMedia, SessionStore
from .recognition_settings import RecognitionSettings
from .status_notifier import StatusNotifier
from .working_state import WorkingState


class SessionMapper:
    """
    Converts between the remembered ``Session`` and the state of the workspace, in both directions.

    Restoring keeps only what is still valid: model choices of presets that no longer exist, cannot run here or need a
    license the user has not accepted are dropped one by one, as are tasks without presets and non-positive frame
    steps. The remembered media of each task stay unopened until the task is shown, and are saved again unchanged
    until then. Saving writes the open media and shown picture of every task and the settings; a failed save is
    reported, not raised.
    """

    def __init__(
        self,
        model_selector: ModelSelector,
        license_consent: LicenseConsent,
        store: SessionStore,
        notifier: StatusNotifier,
        working: WorkingState,
        settings: RecognitionSettings,
    ) -> None:
        """
        Parameters
        ----------
        model_selector : ModelSelector
            Presets of every task, validating remembered model choices.
        license_consent : LicenseConsent
            Licenses accepted by the user, required by some models.
        store : SessionStore
            File remembering the session.
        notifier : StatusNotifier
            Views told about a failed save.
        working : WorkingState
            Open media and shown picture.
        settings : RecognitionSettings
            Choices of the user.
        """
        self._model_selector: ModelSelector = model_selector
        self._license_consent: LicenseConsent = license_consent
        self._store: SessionStore = store
        self._notifier: StatusNotifier = notifier
        self._working: WorkingState = working
        self._settings: RecognitionSettings = settings
        self._unopened_media: dict[RecognitionTask, SessionMedia] = {}

    def apply_stored(self) -> None:
        """
        Take over the valid choices of the remembered session into the settings.
        """
        session: Session = self._store.load()
        self._unopened_media = dict(session.media)
        for task, selection in session.selections.items():
            try:
                validated: ModelSelection = self._model_selector.validated(selection)
                self._license_consent.ensure_permitted(self._model_selector.model_of(validated))
            except (KeyError, ValueError, TypeError, PermissionError, ModuleNotFoundError):
                continue
            self._settings.selections[task] = validated
        if session.task is not None and session.task in self._model_selector.tasks:
            self._settings.task = session.task
        if session.frame_step is not None and session.frame_step > 0:
            self._settings.sampling = VideoSampling(session.frame_step)
        if session.inference_mode is not None:
            self._settings.inference_mode = session.inference_mode
        if session.is_auto_inference is not None:
            self._settings.is_auto_inference = session.is_auto_inference

    def take_unopened_media(self, task: RecognitionTask) -> SessionMedia | None:
        """
        Remembered media of a task not opened yet in this run, handed out once.

        Parameters
        ----------
        task : RecognitionTask
            Task about to be shown.

        Returns
        -------
        SessionMedia | None
            Media of the last session; ``None`` when none were remembered or they were taken already.
        """
        return self._unopened_media.pop(task, None)

    def save(self) -> None:
        """
        Remember the open media and shown picture of every task and the settings, reporting a failed write.
        """
        self._notifier.save_reporting_failure(lambda: self._store.save(self.session()), "Could not save the session")

    def session(self) -> Session:
        """
        Session describing the current state.

        Returns
        -------
        Session
            Open media and shown picture of every task, and the settings.
        """
        media: dict[RecognitionTask, SessionMedia] = dict(self._unopened_media)
        for task, parked in self._working.parked_media.items():
            media[task] = self._media_of(tuple(parked.media), parked.current_key)
        media[self._settings.task] = self._media_of(tuple(self._working.media), self._working.current_key)
        return Session(
            media=media,
            task=self._settings.task,
            frame_step=self._settings.sampling.frame_step,
            inference_mode=self._settings.inference_mode,
            is_auto_inference=self._settings.is_auto_inference,
            selections=dict(self._settings.selections),
        )

    @staticmethod
    def _media_of(paths: tuple[Path, ...], current_key: FrameKey | None) -> SessionMedia:
        return SessionMedia(
            paths=paths,
            current_path=None if current_key is None else current_key.path,
            current_frame_index=None if current_key is None else current_key.frame_index,
        )
