from collections.abc import Callable, Sequence

from ..media import FrameKey, MediaItem, VideoSampling
from ..models import ModelProfile
from .background_scope import BackgroundScope


class BackgroundPlanner:
    """
    Chooses what to recognize next in the background, and remembers what failed.

    The shown media comes first: the shown image, or the sampled frames of the shown video from the shown frame on and
    then from its start. With ``BackgroundScope.ALL`` the other media follow in list order after the shown one.
    Pictures that could not be read are skipped for the profile they failed with; a model error pauses background
    recognition until the user does something that may fix it. While the user pins a stored profile other than the
    selected model, nothing runs, so the shown results are not replaced.
    """

    def __init__(self) -> None:
        self._failed_keys: dict[ModelProfile, set[FrameKey]] = {}
        self._is_paused: bool = False
        self._is_pinned: bool = False

    @property
    def is_paused(self) -> bool:
        """
        Whether a model error paused background recognition.

        Returns
        -------
        bool
            True until ``resume``.
        """
        return self._is_paused

    def pin(self) -> None:
        """
        Keep the background from running while the user looks at another stored profile.
        """
        self._is_pinned = True

    def unpin(self) -> None:
        """
        Let the background run again.
        """
        self._is_pinned = False

    def pause(self) -> None:
        """
        Stop planning after a model error.
        """
        self._is_paused = True

    def resume(self) -> None:
        """
        Plan again after the user acted.
        """
        self._is_paused = False

    def record_failures(self, profile: ModelProfile, frame_keys: Sequence[FrameKey]) -> None:
        """
        Skip pictures that could not be read with a profile.

        Parameters
        ----------
        profile : ModelProfile
            Profile the pictures failed with.
        frame_keys : Sequence[FrameKey]
            Unreadable pictures.
        """
        self._failed_keys.setdefault(profile, set()).update(frame_keys)

    def forget_failures(self) -> None:
        """
        Try every failed picture again.
        """
        self._failed_keys.clear()

    def is_failed(self, profile: ModelProfile, frame_key: FrameKey) -> bool:
        """
        Whether a picture failed with a profile.

        Parameters
        ----------
        profile : ModelProfile
            Profile to look up.
        frame_key : FrameKey
            Picture to look up.

        Returns
        -------
        bool
            True when it could not be read.
        """
        return frame_key in self._failed_keys.get(profile, set())

    def next_keys(
        self,
        profile: ModelProfile,
        scope: BackgroundScope,
        current: FrameKey | None,
        media: Sequence[MediaItem],
        sampling: VideoSampling,
        is_up_to_date: Callable[[FrameKey], bool],
    ) -> tuple[FrameKey, ...]:
        """
        Pictures of the next background job: the pending pictures of the first media that has any.

        Parameters
        ----------
        profile : ModelProfile
            Profile of the selected model.
        scope : BackgroundScope
            Which media are recognized in the background.
        current : FrameKey | None
            Shown picture.
        media : Sequence[MediaItem]
            Open media in list order.
        sampling : VideoSampling
            Sampled frames of videos.
        is_up_to_date : Callable[[FrameKey], bool]
            Whether a picture has an up-to-date result of the profile.

        Returns
        -------
        tuple[FrameKey, ...]
            Pictures in recognition order; empty when nothing is to do.
        """
        if self._is_paused or self._is_pinned or scope is BackgroundScope.OFF or current is None:
            return ()
        paths: list[MediaItem] = list(media)
        shown_index: int = next((index for index, item in enumerate(paths) if item.path == current.path), -1)
        if shown_index < 0:
            return ()
        ordered: list[MediaItem] = [paths[shown_index]]
        if scope is BackgroundScope.ALL:
            ordered.extend(paths[shown_index + 1 :])
            ordered.extend(paths[:shown_index])
        failed: set[FrameKey] = self._failed_keys.get(profile, set())
        for item in ordered:
            keys: list[FrameKey] = list(item.frame_keys(sampling))
            if item is paths[shown_index] and current.frame_index is not None:
                start: int = next(
                    (
                        position
                        for position, key in enumerate(keys)
                        if key.frame_index is not None and key.frame_index >= current.frame_index
                    ),
                    0,
                )
                keys = keys[start:] + keys[:start]
            pending: tuple[FrameKey, ...] = tuple(key for key in keys if key not in failed and not is_up_to_date(key))
            if pending:
                return self._ascending_runs_first(pending)
        return ()

    @staticmethod
    def _ascending_runs_first(keys: tuple[FrameKey, ...]) -> tuple[FrameKey, ...]:
        if not keys or keys[0].frame_index is None:
            return keys
        end: int = 1
        while end < len(keys):
            previous: int | None = keys[end - 1].frame_index
            following: int | None = keys[end].frame_index
            if previous is None or following is None or following <= previous:
                break
            end += 1
        return keys[:end]
