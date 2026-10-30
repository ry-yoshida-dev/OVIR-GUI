from collections.abc import Callable, Iterable
from pathlib import Path

from ..analysis import ProfileComparison, ResultStatistics
from ..media import FrameKey, MediaItem
from ..models import ModelProfile
from ..prompting import FramePrompt, PicturePrompts, PromptChange, PromptSignature, QueryKind
from ..results import ProfileSummary, ResultCatalog, ResultLibrary, StoredResult
from ..review import ReviewFilter
from .background_planner import BackgroundPlanner
from .class_workbench import ClassWorkbench
from .media_state import MediaState
from .media_status import MediaStatus
from .recognition_settings import RecognitionSettings
from .review_settings import ReviewSettings
from .working_state import WorkingState


class ResultReadModel:
    """
    Answers what the stored results say about the open media: which pictures are recognized, which are up to date
    with the current classes and drawings, and the statistics and comparisons of the shown results.

    A result is up to date while what the classes and drawings query on its picture, narrowed to the query kinds of
    its profile, is what it was recognized with. Nothing is cached: every answer reads the current state.
    """

    def __init__(
        self,
        working: WorkingState,
        settings: RecognitionSettings,
        library: ResultLibrary,
        workbench: ClassWorkbench,
        review: ReviewSettings,
        planner: BackgroundPlanner,
    ) -> None:
        """
        Parameters
        ----------
        working : WorkingState
            Open media and shown profiles.
        settings : RecognitionSettings
            Current task and sampling.
        library : ResultLibrary
            Stored results of every profile.
        workbench : ClassWorkbench
            Classes and drawings the results depend on.
        review : ReviewSettings
            Review filter of the current task.
        planner : BackgroundPlanner
            Pictures that could not be recognized.
        """
        self._working: WorkingState = working
        self._settings: RecognitionSettings = settings
        self._library: ResultLibrary = library
        self._workbench: ClassWorkbench = workbench
        self._review: ReviewSettings = review
        self._planner: BackgroundPlanner = planner

    def shown_catalog(self) -> ResultCatalog | None:
        """
        Results of the shown profile.

        Returns
        -------
        ResultCatalog | None
            ``None`` while no profile is shown.
        """
        return self._catalog_of(self._working.shown_profile)

    def compared_catalog(self) -> ResultCatalog | None:
        """
        Results of the compared profile.

        Returns
        -------
        ResultCatalog | None
            ``None`` while none is compared.
        """
        return self._catalog_of(self._working.compared_profile)

    def task_profiles(self) -> tuple[ModelProfile, ...]:
        """
        Stored profiles of the current task.

        Returns
        -------
        tuple[ModelProfile, ...]
            Profiles in the order they were added.
        """
        return tuple(profile for profile in self._library.profiles if profile.task is self._settings.task)

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

        signatures: dict[FramePrompt, PromptSignature] = {}

        def current_of(frame_key: FrameKey) -> PromptSignature:
            drawings: FramePrompt = prompts.relevant_to(frame_key, profile.is_sequential)
            signature: PromptSignature | None = signatures.get(drawings)
            if signature is None:
                signature = class_signature.with_drawings(drawings)
                signatures[drawings] = signature
            return signature

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
        return item.frame_keys(self._settings.sampling)

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
        return tuple(key for path in self._working.media for key in catalog.keys_of(path))

    def change_check(self) -> Callable[[FrameKey], PromptChange | None]:
        """
        How the classes changed since pictures were recognized with the shown profile, reading what the classes
        query now once for every picture looked up.

        Returns
        -------
        Callable[[FrameKey], PromptChange | None]
            Change of a picture, ``None`` when it has no result of the shown profile or no profile is shown.
        """
        profile: ModelProfile | None = self._working.shown_profile
        if profile is None:
            return lambda frame_key: None
        current_of: Callable[[FrameKey], PromptSignature] = self.signature_for(profile)

        def change_of(frame_key: FrameKey) -> PromptChange | None:
            return self._library.prompt_change_of(profile, frame_key, current_of(frame_key))

        return change_of

    def media_statuses(self) -> dict[Path, MediaStatus]:
        """
        Recognition state of every open file with the shown profile.

        Returns
        -------
        dict[Path, MediaStatus]
            Status per file in list order.
        """
        catalog: ResultCatalog | None = self.shown_catalog()
        profile: ModelProfile | None = self._working.shown_profile
        is_up_to_date: Callable[[FrameKey], bool] = self.up_to_date_check(profile)
        review_filter: ReviewFilter = self._review.review_filter
        statuses: dict[Path, MediaStatus] = {}
        for path, item in self._working.media.items():
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
                    if stored is not None:
                        kept_count += len(stored.kept_indices(review_filter))
            statuses[path] = MediaStatus(
                state=MediaState.of_counts(len(expected), recognized_count, outdated_count, failed_count),
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
            path: self.expected_keys(item) for path, item in self._working.media.items()
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
            review_filter: ReviewFilter = self._review.filter_of(profile.task)
            for key in self.recognized_keys(catalog):
                stored: StoredResult | None = catalog.stored_of(key)
                if stored is not None:
                    finding_count += len(review_filter.findings_of(stored.result))
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
            self._settings.task,
            catalog,
            self.recognized_keys(catalog),
            self._workbench.class_names,
            self._review.review_filter,
        )

    def comparison(self) -> ProfileComparison | None:
        """
        Class-by-class comparison of the kept findings of the shown and the compared results over the open media.

        Returns
        -------
        ProfileComparison | None
            ``None`` unless a profile is shown and another is compared.
        """
        shown: ResultCatalog | None = self.shown_catalog()
        compared: ResultCatalog | None = self.compared_catalog()
        if shown is None or compared is None:
            return None
        return ProfileComparison.between(
            shown, compared, self.recognized_keys(shown), self._workbench.class_names, self._review.review_filter
        )

    def outdated_keys(self, profile: ModelProfile, frame_keys: tuple[FrameKey, ...]) -> dict[FrameKey, PromptChange]:
        """
        Pictures whose result of a profile was recognized with other classes.

        Parameters
        ----------
        profile : ModelProfile
            Profile of the results.
        frame_keys : tuple[FrameKey, ...]
            Pictures to check, usually the ``recognized_keys`` of the catalog of the profile.

        Returns
        -------
        dict[FrameKey, PromptChange]
            How the classes changed for every outdated picture, in the order of ``frame_keys``.
        """
        return self._library.outdated_keys(profile, self.signature_for(profile), frame_keys)

    def up_to_date_check(self, profile: ModelProfile | None) -> Callable[[FrameKey], bool]:
        """
        Whether pictures have an up-to-date result of a profile.

        Parameters
        ----------
        profile : ModelProfile | None
            Profile of the results; ``None`` finds nothing up to date.

        Returns
        -------
        Callable[[FrameKey], bool]
            True for a picture recognized with what the classes and drawings query on it now.
        """
        if profile is None or profile not in self._library:
            return lambda frame_key: False
        catalog: ResultCatalog = self._library.catalog_of(profile)
        current_of: Callable[[FrameKey], PromptSignature] = self.signature_for(profile)

        narrowed_signatures: dict[PromptSignature, PromptSignature] = {}
        unchanged_pairs: dict[tuple[PromptSignature, PromptSignature], bool] = {}

        def is_up_to_date(frame_key: FrameKey) -> bool:
            stored: StoredResult | None = catalog.stored_of(frame_key)
            if stored is None:
                return False
            current: PromptSignature = current_of(frame_key)
            narrowed: PromptSignature | None = narrowed_signatures.get(current)
            if narrowed is None:
                narrowed = current.for_query_kinds(profile.query_kinds)
                narrowed_signatures[current] = narrowed
            pair: tuple[PromptSignature, PromptSignature] = (stored.signature, narrowed)
            is_unchanged: bool | None = unchanged_pairs.get(pair)
            if is_unchanged is None:
                is_unchanged = PromptChange.between(stored.signature, narrowed).is_unchanged
                unchanged_pairs[pair] = is_unchanged
            return is_unchanged

        return is_up_to_date

    def settled_check(self, profile: ModelProfile) -> Callable[[FrameKey], bool]:
        """
        Whether pictures need no recognition with a profile.

        Parameters
        ----------
        profile : ModelProfile
            Profile to recognize with.

        Returns
        -------
        Callable[[FrameKey], bool]
            True for a picture with an up-to-date result, or, for a model segmenting marked objects, without marks and
            without a result.
        """
        is_up_to_date: Callable[[FrameKey], bool] = self.up_to_date_check(profile)
        if QueryKind.MARK not in profile.query_kinds:
            return is_up_to_date
        prompts: PicturePrompts = self._workbench.picture_board.prompts
        catalog: ResultCatalog | None = self._catalog_of(profile)

        def is_settled(frame_key: FrameKey) -> bool:
            if is_up_to_date(frame_key):
                return True
            is_marked: bool = bool(prompts.relevant_to(frame_key, profile.is_sequential).marks)
            return not is_marked and (catalog is None or frame_key not in catalog)

        return is_settled

    def pending_keys(self, profile: ModelProfile, media: Iterable[MediaItem]) -> tuple[FrameKey, ...]:
        """
        Expected pictures of some files that need recognition with a profile.

        Parameters
        ----------
        profile : ModelProfile
            Profile to recognize with.
        media : Iterable[MediaItem]
            Open files.

        Returns
        -------
        tuple[FrameKey, ...]
            Pictures not settled, in media and frame order.
        """
        is_settled: Callable[[FrameKey], bool] = self.settled_check(profile)
        return tuple(key for item in media for key in self.expected_keys(item) if not is_settled(key))

    def _catalog_of(self, profile: ModelProfile | None) -> ResultCatalog | None:
        if profile is None or profile not in self._library:
            return None
        return self._library.catalog_of(profile)
