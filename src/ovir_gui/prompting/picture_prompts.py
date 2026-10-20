from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path

from ..media import FrameKey
from .exemplar_box import ExemplarBox
from .frame_prompt import FramePrompt
from .object_mark import ObjectMark


@dataclass(frozen=True, eq=False)
class PicturePrompts:
    """
    Every exemplar box and object mark drawn on the open pictures, detached from later edits.

    Attributes
    ----------
    exemplars : tuple[ExemplarBox, ...]
        Exemplar boxes in drawing order.
    marks : tuple[ObjectMark, ...]
        Object marks, at most one per picture and object.

    Raises
    ------
    ValueError
        If an object is marked twice on the same picture.
    """

    exemplars: tuple[ExemplarBox, ...] = ()
    marks: tuple[ObjectMark, ...] = ()

    def __post_init__(self) -> None:
        identities: list[tuple[FrameKey, int]] = [(mark.frame_key, mark.object_id) for mark in self.marks]
        if len(set(identities)) != len(identities):
            raise ValueError("an object can be marked only once per picture.")

    @property
    def is_empty(self) -> bool:
        """
        Whether nothing is drawn on any picture.

        Returns
        -------
        bool
            True without exemplars and marks.
        """
        return not self.exemplars and not self.marks

    def of(self, frame_key: FrameKey) -> FramePrompt:
        """
        What is drawn on one picture.

        Parameters
        ----------
        frame_key : FrameKey
            Image or video frame.

        Returns
        -------
        FramePrompt
            Exemplars and marks of the picture.
        """
        return FramePrompt(
            exemplars=tuple(box for box in self.exemplars if box.frame_key == frame_key),
            marks=self._ordered(mark for mark in self.marks if mark.frame_key == frame_key),
        )

    def of_media(self, path: Path) -> FramePrompt:
        """
        What is drawn on every frame of one media file.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        FramePrompt
            Exemplars and marks of the file, marks ordered by frame and object.
        """
        return FramePrompt(
            exemplars=tuple(box for box in self.exemplars if box.frame_key.path == path),
            marks=self._ordered(mark for mark in self.marks if mark.frame_key.path == path),
        )

    def relevant_to(self, frame_key: FrameKey, is_sequential: bool) -> FramePrompt:
        """
        What the result of one picture depends on.

        Parameters
        ----------
        frame_key : FrameKey
            Recognized picture.
        is_sequential : bool
            Whether the model follows objects through a video, so every frame depends on the whole file.

        Returns
        -------
        FramePrompt
            Drawings of the picture, or of its whole file for a sequential model.
        """
        return self.of_media(frame_key.path) if is_sequential else self.of(frame_key)

    def marked_keys(self, path: Path) -> tuple[FrameKey, ...]:
        """
        Pictures of one media file holding object marks.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        tuple[FrameKey, ...]
            Marked pictures in frame order.
        """
        keys: set[FrameKey] = {mark.frame_key for mark in self.marks if mark.frame_key.path == path}
        return tuple(sorted(keys, key=lambda key: key.sort_key()))

    def restricted_to(self, paths: Iterable[Path]) -> "PicturePrompts":
        """
        Drawings on some media files only.

        Parameters
        ----------
        paths : Iterable[Path]
            Files to keep.

        Returns
        -------
        PicturePrompts
            Exemplars and marks of the files.
        """
        kept: frozenset[Path] = frozenset(paths)
        return PicturePrompts(
            exemplars=tuple(box for box in self.exemplars if box.frame_key.path in kept),
            marks=tuple(mark for mark in self.marks if mark.frame_key.path in kept),
        )

    @staticmethod
    def _ordered(marks: Iterable[ObjectMark]) -> tuple[ObjectMark, ...]:
        return tuple(sorted(marks, key=lambda mark: (mark.frame_key.sort_key(), mark.object_id)))
