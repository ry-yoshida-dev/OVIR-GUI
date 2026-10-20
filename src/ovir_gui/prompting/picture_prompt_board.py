from collections.abc import Sequence
from pathlib import Path

from ..media import FrameKey
from .exemplar_box import ExemplarBox
from .object_mark import ObjectMark
from .picture_prompts import PicturePrompts


class PicturePromptBoard:
    """
    Exemplar boxes and object marks the user draws on the pictures being recognized.

    Drawings are attached to class names like reference boxes, so they follow renames and are dropped with their
    class. Objects are numbered per media file, so a video tracker follows one object across every frame it is marked
    on.
    """

    def __init__(self) -> None:
        self._exemplars: list[ExemplarBox] = []
        self._marks: dict[tuple[FrameKey, int], ObjectMark] = {}

    @property
    def prompts(self) -> PicturePrompts:
        """
        Every drawing, detached from later edits.

        Returns
        -------
        PicturePrompts
            Exemplars and marks.
        """
        return PicturePrompts(exemplars=tuple(self._exemplars), marks=tuple(self._marks.values()))

    def next_object_id(self, path: Path) -> int:
        """
        Identifier of a new object on a media file.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        int
            One more than the largest identifier marked on the file, or 1.
        """
        identifiers: list[int] = [object_id for frame_key, object_id in self._marks if frame_key.path == path]
        return max(identifiers, default=0) + 1

    def add_exemplar(self, box: ExemplarBox) -> None:
        """
        Draw an exemplar box.

        Parameters
        ----------
        box : ExemplarBox
            Box to add.
        """
        self._exemplars.append(box)

    def remove_exemplar(self, frame_key: FrameKey, index: int) -> None:
        """
        Remove one exemplar box of a picture.

        Parameters
        ----------
        frame_key : FrameKey
            Picture of the box.
        index : int
            Position of the box among the boxes of the picture.

        Raises
        ------
        IndexError
            If the picture has no such box.
        """
        on_picture: list[ExemplarBox] = [box for box in self._exemplars if box.frame_key == frame_key]
        if not 0 <= index < len(on_picture):
            raise IndexError(f"exemplar index must be in [0, {len(on_picture)}). got {index}")
        removed: ExemplarBox = on_picture[index]
        position: int = next(position for position, box in enumerate(self._exemplars) if box is removed)
        del self._exemplars[position]

    def set_mark(self, mark: ObjectMark) -> None:
        """
        Mark an object on a picture, replacing its earlier mark there.

        Every mark of the object on its media file takes the class of the new mark.

        Parameters
        ----------
        mark : ObjectMark
            Mark to store.
        """
        for identity, existing in list(self._marks.items()):
            if existing.frame_key.path == mark.frame_key.path and existing.object_id == mark.object_id:
                self._marks[identity] = existing.renamed(mark.class_name)
        self._marks[(mark.frame_key, mark.object_id)] = mark

    def remove_mark(self, frame_key: FrameKey, object_id: int) -> None:
        """
        Remove the mark of one object on one picture.

        Parameters
        ----------
        frame_key : FrameKey
            Picture of the mark.
        object_id : int
            Object to unmark; nothing happens when it is not marked there.
        """
        self._marks.pop((frame_key, object_id), None)

    def remove_object(self, path: Path, object_id: int) -> None:
        """
        Remove every mark of one object of a media file.

        Parameters
        ----------
        path : Path
            Image or video file.
        object_id : int
            Object to forget.
        """
        self._marks = {
            identity: mark
            for identity, mark in self._marks.items()
            if not (mark.frame_key.path == path and mark.object_id == object_id)
        }

    def clear_picture(self, frame_key: FrameKey) -> None:
        """
        Remove every drawing of one picture.

        Parameters
        ----------
        frame_key : FrameKey
            Image or video frame.
        """
        self._exemplars = [box for box in self._exemplars if box.frame_key != frame_key]
        self._marks = {identity: mark for identity, mark in self._marks.items() if mark.frame_key != frame_key}

    def clear_media(self, path: Path) -> None:
        """
        Remove every drawing of one media file.

        Parameters
        ----------
        path : Path
            Image or video file.
        """
        self._exemplars = [box for box in self._exemplars if box.frame_key.path != path]
        self._marks = {identity: mark for identity, mark in self._marks.items() if mark.frame_key.path != path}

    def replace(self, prompts: PicturePrompts) -> None:
        """
        Replace every drawing, e.g. with the drawings remembered from the last session.

        Parameters
        ----------
        prompts : PicturePrompts
            New drawings.
        """
        self._exemplars = list(prompts.exemplars)
        self._marks = {(mark.frame_key, mark.object_id): mark for mark in prompts.marks}

    def rename_class(self, old_name: str, new_name: str) -> None:
        """
        Move the drawings of a renamed class to its new name.

        Parameters
        ----------
        old_name : str
            Previous class name.
        new_name : str
            Current class name.
        """
        self._exemplars = [box.renamed(new_name) if box.class_name == old_name else box for box in self._exemplars]
        self._marks = {
            identity: mark.renamed(new_name) if mark.class_name == old_name else mark
            for identity, mark in self._marks.items()
        }

    def retain_classes(self, class_names: Sequence[str]) -> None:
        """
        Remove the drawings of classes that no longer exist.

        Parameters
        ----------
        class_names : Sequence[str]
            Current class names.
        """
        kept: frozenset[str] = frozenset(class_names)
        self._exemplars = [box for box in self._exemplars if box.class_name in kept]
        self._marks = {identity: mark for identity, mark in self._marks.items() if mark.class_name in kept}
