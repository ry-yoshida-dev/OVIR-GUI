from dataclasses import dataclass
from pathlib import Path
from typing import ClassVar

from ..storage import (
    ClassSetStore,
    ClassThresholdStore,
    DuplicateSuppressionStore,
    LicenseConsentStore,
    PicturePromptStore,
    PlaybackStore,
    ResultsStore,
    SessionStore,
    UploadStore,
)
from ..vocabulary import ClassListStore


@dataclass(frozen=True)
class WorkspaceStores:
    """
    Data directory the workspace reads at start and writes after changes, ``ovir_gui_data`` by default.

    ```text
    ovir_gui_data/
    ├── last_classes.txt        # classes of the last run
    ├── classes/<name>.ovirset  # saved class sets with their reference images
    ├── results.ovirresults     # results of every model profile
    ├── class_thresholds.json   # minimum confidence per task, class and phrase
    ├── duplicate_suppression.json  # review suppression of overlapping boxes per task
    ├── license_consent.json    # licenses of optional modules the user accepted
    ├── picture_prompts.json    # exemplar boxes and object marks drawn on pictures
    ├── session.json            # open media, shown picture, task, sampling, model choices
    ├── uploads/                # files uploaded from a browser
    └── playback/               # browser-playable copies of videos the browser cannot decode
    ```

    Attributes
    ----------
    root_directory : Path
        Data directory.
    class_list_store : ClassListStore
        Class list of the last run.
    class_set_store : ClassSetStore
        Saved class sets with their reference images.
    results_store : ResultsStore
        Results of every model.
    class_threshold_store : ClassThresholdStore
        Minimum confidence of each class per task.
    duplicate_suppression_store : DuplicateSuppressionStore
        Review suppression of overlapping boxes per task.
    license_consent_store : LicenseConsentStore
        Licenses of optional modules the user accepted.
    picture_prompt_store : PicturePromptStore
        Exemplar boxes and object marks drawn on pictures.
    session_store : SessionStore
        What was open and chosen.
    upload_store : UploadStore
        Files sent from a browser.
    playback_store : PlaybackStore
        Browser-playable copies of videos.
    """

    DEFAULT_DIRECTORY_NAME: ClassVar[str] = "ovir_gui_data"

    root_directory: Path
    class_list_store: ClassListStore
    class_set_store: ClassSetStore
    results_store: ResultsStore
    class_threshold_store: ClassThresholdStore
    duplicate_suppression_store: DuplicateSuppressionStore
    license_consent_store: LicenseConsentStore
    picture_prompt_store: PicturePromptStore
    session_store: SessionStore
    upload_store: UploadStore
    playback_store: PlaybackStore

    @classmethod
    def in_directory(cls, root_directory: Path) -> "WorkspaceStores":
        """
        Stores of one data directory.

        Parameters
        ----------
        root_directory : Path
            Data directory; created only when something is written.

        Returns
        -------
        WorkspaceStores
            Every store of the directory.
        """
        return cls(
            root_directory=root_directory,
            class_list_store=ClassListStore(root_directory),
            class_set_store=ClassSetStore(root_directory),
            results_store=ResultsStore(root_directory),
            class_threshold_store=ClassThresholdStore(root_directory),
            duplicate_suppression_store=DuplicateSuppressionStore(root_directory),
            license_consent_store=LicenseConsentStore(root_directory),
            picture_prompt_store=PicturePromptStore(root_directory),
            session_store=SessionStore(root_directory),
            upload_store=UploadStore(root_directory),
            playback_store=PlaybackStore(root_directory),
        )
