from collections.abc import Callable, Sequence

from ..media import FrameKey, MediaItem
from ..models import ModelProfile
from .background_scope import BackgroundScope


class BackgroundPlanner:
    """
    Chooses what to recognize next in the background, and remembers what failed.

    Only images are recognized in the background; videos are long and costly, so their frames are recognized only when
    the user runs them. The shown image comes first; with ``BackgroundScope.ALL`` the other images follow in list order
    after the shown media.
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
        is_up_to_date: Callable[[FrameKey], bool],
    ) -> tuple[FrameKey, ...]:
        """
        Picture of the next background job: the first image in order that still needs a result.

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
        is_up_to_date : Callable[[FrameKey], bool]
            Whether a picture has an up-to-date result of the profile.

        Returns
        -------
        tuple[FrameKey, ...]
            The picture to recognize; empty when nothing is to do.
        """
        if self._is_paused or self._is_pinned or scope is BackgroundScope.OFF or current is None:
            return ()
        items: list[MediaItem] = list(media)
        shown_index: int = next((index for index, item in enumerate(items) if item.path == current.path), -1)
        if shown_index < 0:
            return ()
        ordered: list[MediaItem] = [items[shown_index]]
        if scope is BackgroundScope.ALL:
            ordered.extend(items[shown_index + 1 :])
            ordered.extend(items[:shown_index])
        failed: set[FrameKey] = self._failed_keys.get(profile, set())
        for item in ordered:
            if item.is_video:
                continue
            key: FrameKey = item.key_at(None)
            if key not in failed and not is_up_to_date(key):
                return (key,)
        return ()
