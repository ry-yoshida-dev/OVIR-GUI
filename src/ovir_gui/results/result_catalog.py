import bisect
from collections.abc import Iterable
from pathlib import Path

from ..media import FrameKey
from ..prompting import PromptChange, PromptSignature
from ..recognition import FrameResult
from .stored_result import StoredResult


class ResultCatalog:
    """
    Latest result of every recognized image and video frame of one model profile.

    Recording a picture again replaces its previous result and keeps all of its findings. The recognized frames of
    each video are kept sorted; a frame that was not recognized shows no result.
    """

    def __init__(self) -> None:
        self._results: dict[FrameKey, StoredResult] = {}
        self._frame_indices: dict[Path, list[int]] = {}

    def __len__(self) -> int:
        return len(self._results)

    def __contains__(self, frame_key: object) -> bool:
        return frame_key in self._results

    @property
    def frame_keys(self) -> tuple[FrameKey, ...]:
        """
        Recognized pictures.

        Returns
        -------
        tuple[FrameKey, ...]
            Keys in recording order.
        """
        return tuple(self._results)

    def record(self, frame_key: FrameKey, result: FrameResult, signature: PromptSignature) -> None:
        """
        Store the result of one picture, replacing an earlier one.

        Parameters
        ----------
        frame_key : FrameKey
            Recognized image or video frame.
        result : FrameResult
            What the model recognized.
        signature : PromptSignature
            What the classes queried, narrowed to the query kinds of the model.
        """
        if frame_key not in self._results and frame_key.frame_index is not None:
            bisect.insort(self._frame_indices.setdefault(frame_key.path, []), frame_key.frame_index)
        self._results[frame_key] = StoredResult(result=result, signature=signature)

    def restore(self, frame_key: FrameKey, stored: StoredResult) -> None:
        """
        Put back a result read from the results archive, with its rejections.

        Parameters
        ----------
        frame_key : FrameKey
            Recognized image or video frame.
        stored : StoredResult
            Result, signature and rejections.
        """
        self.record(frame_key, stored.result, stored.signature)
        self._results[frame_key] = stored

    def stored_of(self, frame_key: FrameKey) -> StoredResult | None:
        """
        Stored result of one picture.

        Parameters
        ----------
        frame_key : FrameKey
            Picture to look up.

        Returns
        -------
        StoredResult | None
            ``None`` if it has not been recognized.
        """
        return self._results.get(frame_key)

    def result_of(self, frame_key: FrameKey) -> FrameResult | None:
        """
        Result of one picture.

        Parameters
        ----------
        frame_key : FrameKey
            Picture to look up.

        Returns
        -------
        FrameResult | None
            ``None`` if it has not been recognized.
        """
        stored: StoredResult | None = self._results.get(frame_key)
        return None if stored is None else stored.result

    def frame_indices_of(self, path: Path) -> list[int]:
        """
        Recognized frames of a video.

        Parameters
        ----------
        path : Path
            Video file.

        Returns
        -------
        list[int]
            Frame indices in ascending order; a copy.
        """
        return list(self._frame_indices.get(path, ()))

    def keys_of(self, path: Path) -> tuple[FrameKey, ...]:
        """
        Recognized pictures of one media file.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        tuple[FrameKey, ...]
            The image key, or the recognized frames of the video in frame order.
        """
        image_key: FrameKey = FrameKey(path)
        if image_key in self._results:
            return (image_key,)
        return tuple(FrameKey(path, frame_index) for frame_index in self._frame_indices.get(path, ()))

    def displayed_key(self, frame_key: FrameKey) -> FrameKey | None:
        """
        Recognized picture whose result is shown for a picture.

        Parameters
        ----------
        frame_key : FrameKey
            Shown image or video frame.

        Returns
        -------
        FrameKey | None
            The key itself when recognized, ``None`` otherwise; a result is never shown on another frame.
        """
        return frame_key if frame_key in self._results else None

    def set_accepted(self, frame_key: FrameKey, indices: Iterable[int], is_accepted: bool) -> None:
        """
        Keep or reject some findings of one picture.

        Parameters
        ----------
        frame_key : FrameKey
            Recognized picture.
        indices : Iterable[int]
            Findings of its result.
        is_accepted : bool
            True to keep them, False to reject them.

        Raises
        ------
        KeyError
            If the picture has not been recognized.
        IndexError
            If an index is outside its findings; nothing changes then.
        """
        stored: StoredResult | None = self._results.get(frame_key)
        if stored is None:
            raise KeyError(f"{frame_key.label} has not been recognized")
        self._results[frame_key] = stored.with_accepted(frozenset(indices), is_accepted)

    def prompt_change_of(self, frame_key: FrameKey, current: PromptSignature) -> PromptChange | None:
        """
        How the classes changed since a picture was recognized.

        Parameters
        ----------
        frame_key : FrameKey
            Picture to look up.
        current : PromptSignature
            What the classes query now, narrowed to the query kinds of the model.

        Returns
        -------
        PromptChange | None
            ``None`` if it has not been recognized.
        """
        stored: StoredResult | None = self._results.get(frame_key)
        return None if stored is None else PromptChange.between(stored.signature, current)

    def remove(self, frame_key: FrameKey) -> None:
        """
        Forget the result of one picture.

        Parameters
        ----------
        frame_key : FrameKey
            Picture to forget; nothing happens if it is not stored.
        """
        if self._results.pop(frame_key, None) is None or frame_key.frame_index is None:
            return
        indices: list[int] = self._frame_indices.get(frame_key.path, [])
        position: int = bisect.bisect_left(indices, frame_key.frame_index)
        if position < len(indices) and indices[position] == frame_key.frame_index:
            indices.pop(position)
        if not indices:
            self._frame_indices.pop(frame_key.path, None)
