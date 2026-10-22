from collections.abc import Callable, Sequence

from ..media import FrameKey, MediaItem
from ..models import ModelProfile
from .inference_mode import InferenceMode


class BackgroundPlanner:
    """
    Chooses what to recognize next in the background, and remembers what failed.

    With ``InferenceMode.SHOWN`` only the picture on screen is recognized: the image, or the sampled frame at or before
    the shown video frame. With ``InferenceMode.ALL`` the shown media comes first, from the shown frame on, and the
    other media follow in list order. While the shown video plays, in either mode, its sampled frames from the shown
    frame on come first, in frame order, so results arrive just ahead of playback. Videos are left to the user with
    sequential (tracking) models, which must run a whole video in frame order.
    Pictures that could not be read are skipped for the profile they failed with; a model error pauses background
    recognition until the user does something that may fix it. While the user pins a stored profile other than the
    selected model, nothing runs, so the shown results are not replaced.
    """

    def __init__(self) -> None:
        self._failed_keys: dict[ModelProfile, set[FrameKey]] = {}
        self._pause_reason: str | None = None
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
        return self._pause_reason is not None

    @property
    def pause_reason(self) -> str | None:
        """
        Error message that paused background recognition.

        Returns
        -------
        str | None
            Message of the model error; None while not paused.
        """
        return self._pause_reason

    @property
    def is_pinned(self) -> bool:
        """
        Whether the user pins a stored profile other than the selected model.

        Returns
        -------
        bool
            True until ``unpin``.
        """
        return self._is_pinned

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

    def pause(self, reason: str) -> None:
        """
        Stop planning after a model error.

        Parameters
        ----------
        reason : str
            Error message shown to the user.
        """
        self._pause_reason = reason

    def resume(self) -> None:
        """
        Plan again after the user acted.
        """
        self._pause_reason = None

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
        mode: InferenceMode,
        current: FrameKey | None,
        media: Sequence[MediaItem],
        expected_keys: Callable[[MediaItem], tuple[FrameKey, ...]],
        is_up_to_date: Callable[[FrameKey], bool],
        is_playing: bool = False,
    ) -> tuple[FrameKey, ...]:
        """
        Pictures of the next background job.

        Parameters
        ----------
        profile : ModelProfile
            Profile of the selected model.
        mode : InferenceMode
            Which pictures are recognized.
        current : FrameKey | None
            Shown picture.
        media : Sequence[MediaItem]
            Open media in list order.
        expected_keys : Callable[[MediaItem], tuple[FrameKey, ...]]
            Pictures of a media that are recognized: the image, or the sampled frames of the video in order.
        is_up_to_date : Callable[[FrameKey], bool]
            Whether a picture has an up-to-date result of the profile.
        is_playing : bool, optional
            Whether the shown video plays, so the frames ahead of it are recognized first.

        Returns
        -------
        tuple[FrameKey, ...]
            The pending frames ahead of the playing video, the shown picture, or the pending pictures of the first
            media needing results; empty when nothing is to do.
        """
        if self.is_paused or self._is_pinned or current is None:
            return ()
        items: list[MediaItem] = list(media)
        shown_index: int = next((index for index, item in enumerate(items) if item.path == current.path), -1)
        if shown_index < 0:
            return ()
        failed: set[FrameKey] = self._failed_keys.get(profile, set())

        def is_pending(key: FrameKey) -> bool:
            return key not in failed and not is_up_to_date(key)

        shown: MediaItem = items[shown_index]
        if is_playing and shown.is_video and not profile.is_sequential:
            ahead: tuple[FrameKey, ...] = tuple(filter(is_pending, self._keys_ahead(expected_keys(shown), current)))
            if ahead:
                return ahead
        match mode:
            case InferenceMode.SHOWN:
                if shown.is_video and profile.is_sequential:
                    return ()
                key: FrameKey | None = self._sampled_key_at(expected_keys(shown), current)
                return (key,) if key is not None and is_pending(key) else ()
            case InferenceMode.ALL:
                ordered: list[MediaItem] = [*items[shown_index:], *items[:shown_index]]
                for item in ordered:
                    if item.is_video and profile.is_sequential:
                        continue
                    start_frame: int = (current.frame_index or 0) if item.path == current.path else 0
                    keys: list[FrameKey] = sorted(
                        filter(is_pending, expected_keys(item)),
                        key=lambda pending: (pending.frame_index or 0) < start_frame,
                    )
                    if keys:
                        return tuple(keys)
                return ()

    @classmethod
    def _keys_ahead(cls, sampled_keys: tuple[FrameKey, ...], current: FrameKey) -> tuple[FrameKey, ...]:
        start: FrameKey | None = cls._sampled_key_at(sampled_keys, current)
        if start is None:
            return ()
        start_frame: int = start.frame_index or 0
        return tuple(key for key in sampled_keys if (key.frame_index or 0) >= start_frame)

    @staticmethod
    def _sampled_key_at(sampled_keys: tuple[FrameKey, ...], current: FrameKey) -> FrameKey | None:
        frame_index: int = current.frame_index or 0
        earlier: list[FrameKey] = [key for key in sampled_keys if (key.frame_index or 0) <= frame_index]
        if earlier:
            return earlier[-1]
        return sampled_keys[0] if sampled_keys else None
