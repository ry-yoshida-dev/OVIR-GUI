from collections.abc import Callable, Iterable

from ..media import FrameKey
from ..models import ModelProfile
from ..prompting import PromptChange, PromptSignature
from ..recognition import FrameResult
from .result_catalog import ResultCatalog


class ResultLibrary:
    """
    One ``ResultCatalog`` per model profile, in the order the profiles were added.

    Results of every model and option set are kept side by side, so switching back to a model shows its results
    without recognizing again, and two models can be compared.
    """

    def __init__(self) -> None:
        self._catalogs: dict[ModelProfile, ResultCatalog] = {}

    def __contains__(self, profile: object) -> bool:
        return profile in self._catalogs

    @property
    def profiles(self) -> tuple[ModelProfile, ...]:
        """
        Stored profiles.

        Returns
        -------
        tuple[ModelProfile, ...]
            Profiles in the order they were added.
        """
        return tuple(self._catalogs)

    def profile_of_key(self, key: str) -> ModelProfile:
        """
        Look up a profile by its key.

        Parameters
        ----------
        key : str
            ``ModelProfile.key``.

        Returns
        -------
        ModelProfile
            The stored profile.

        Raises
        ------
        KeyError
            If no stored profile has the key.
        """
        for profile in self._catalogs:
            if profile.key == key:
                return profile
        raise KeyError(f"no stored results for profile {key}")

    def add(self, profile: ModelProfile) -> ResultCatalog:
        """
        Make room for the results of a profile.

        Parameters
        ----------
        profile : ModelProfile
            Model and options.

        Returns
        -------
        ResultCatalog
            Catalog of the profile, existing or new.
        """
        return self._catalogs.setdefault(profile, ResultCatalog())

    def catalog_of(self, profile: ModelProfile) -> ResultCatalog:
        """
        Results of one profile.

        Parameters
        ----------
        profile : ModelProfile
            Stored profile.

        Returns
        -------
        ResultCatalog
            Its catalog.

        Raises
        ------
        KeyError
            If the profile is not stored.
        """
        if profile not in self._catalogs:
            raise KeyError(f"no stored results for {profile.label}")
        return self._catalogs[profile]

    def record(
        self, profile: ModelProfile, frame_key: FrameKey, result: FrameResult, signature: PromptSignature
    ) -> None:
        """
        Store one result, adding the profile when new.

        Parameters
        ----------
        profile : ModelProfile
            Model and options it was recognized with.
        frame_key : FrameKey
            Recognized picture.
        result : FrameResult
            What the model recognized.
        signature : PromptSignature
            What the classes queried, narrowed to the query kinds of the model.
        """
        self.add(profile).record(frame_key, result, signature)

    def prompt_change_of(
        self, profile: ModelProfile, frame_key: FrameKey, current: PromptSignature
    ) -> PromptChange | None:
        """
        How the classes changed since a picture was recognized with a profile.

        Parameters
        ----------
        profile : ModelProfile
            Model and options.
        frame_key : FrameKey
            Picture to look up.
        current : PromptSignature
            What the classes query on the picture now, with every query kind and the drawings the picture depends
            on with the profile.

        Returns
        -------
        PromptChange | None
            ``None`` when the picture has no result of the profile.
        """
        catalog: ResultCatalog | None = self._catalogs.get(profile)
        if catalog is None:
            return None
        return catalog.prompt_change_of(frame_key, current.for_query_kinds(profile.query_kinds))

    def outdated_keys(
        self,
        profile: ModelProfile,
        current_of: Callable[[FrameKey], PromptSignature],
        frame_keys: Iterable[FrameKey],
    ) -> dict[FrameKey, PromptChange]:
        """
        Pictures recognized with other classes than the current ones.

        Parameters
        ----------
        profile : ModelProfile
            Model and options.
        current_of : Callable[[FrameKey], PromptSignature]
            What the classes query on a picture now, with every query kind and the drawings the picture depends on
            with the profile.
        frame_keys : Iterable[FrameKey]
            Pictures to check.

        Returns
        -------
        dict[FrameKey, PromptChange]
            Change of every outdated picture among ``frame_keys``.
        """
        catalog: ResultCatalog | None = self._catalogs.get(profile)
        if catalog is None:
            return {}
        changes: dict[FrameKey, PromptChange] = {}
        for frame_key in frame_keys:
            if frame_key not in catalog:
                continue
            change: PromptChange | None = catalog.prompt_change_of(
                frame_key, current_of(frame_key).for_query_kinds(profile.query_kinds)
            )
            if change is not None and not change.is_unchanged:
                changes[frame_key] = change
        return changes

    def remove(self, profile: ModelProfile) -> None:
        """
        Forget the results of one profile.

        Parameters
        ----------
        profile : ModelProfile
            Profile to forget; nothing happens if it is not stored.
        """
        self._catalogs.pop(profile, None)

    def clear(self) -> None:
        """
        Forget every result.
        """
        self._catalogs.clear()
