from collections.abc import Callable, Sequence
from pathlib import Path

from ...media import FrameKey
from .exemplar_box import ExemplarBox
from .history import EditHistory
from .object_mark import ObjectMark
from .snapshot import PicturePrompts


class PicturePromptBoard:
    """
    Exemplar boxes and object marks the user draws on the pictures being recognized.

    Drawings are attached to class names like reference boxes, so they follow renames and are dropped with their
    class. Objects are numbered per media file, so a video tracker follows one object across every frame it is marked
    on. Edits made through ``edit`` are remembered per media file and can be undone and redone.
    """

    def __init__(self) -> None:
        self._exemplars: list[ExemplarBox] = []
        self._marks: dict[tuple[FrameKey, int], ObjectMark] = {}
        self._history: EditHistory = EditHistory()

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

    def drawings_of(self, path: Path) -> PicturePrompts:
        """
        Every drawing on one media file, detached from later edits.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        PicturePrompts
            Exemplars and marks of the file.
        """
        return self.prompts.restricted_to((path,))

    def edit(self, path: Path, change: Callable[["PicturePromptBoard"], object]) -> None:
        """
        Apply an edit to the drawings of one media file and remember the drawings before it for undoing.

        Parameters
        ----------
        path : Path
            Image or video file the edit changes.
        change : Callable[[PicturePromptBoard], object]
            Edit applied to this board; an error it raises is passed on and nothing is remembered.
        """
        before: PicturePrompts = self.drawings_of(path)
        change(self)
        if not before.has_same_drawings(self.drawings_of(path)):
            self._history.record(path, before)

    def can_undo(self, path: Path) -> bool:
        """
        Whether a media file has an edit to undo.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        bool
            True when an earlier state is remembered.
        """
        return self._history.can_undo(path)

    def can_redo(self, path: Path) -> bool:
        """
        Whether a media file has an undone edit to apply again.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        bool
            True when an undone state is remembered.
        """
        return self._history.can_redo(path)

    def undo(self, path: Path) -> None:
        """
        Bring back the drawings of a media file as they were before its last edit.

        Parameters
        ----------
        path : Path
            Image or video file.

        Raises
        ------
        IndexError
            If the file has no edit to undo.
        """
        self._restore(path, self._history.undo(path, self.drawings_of(path)))

    def redo(self, path: Path) -> None:
        """
        Apply the last undone edit of a media file again.

        Parameters
        ----------
        path : Path
            Image or video file.

        Raises
        ------
        IndexError
            If the file has no undone edit.
        """
        self._restore(path, self._history.redo(path, self.drawings_of(path)))

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

    def remove_drawings(self, frame_key: FrameKey, exemplar_indices: Sequence[int], object_ids: Sequence[int]) -> None:
        """
        Remove several exemplar boxes and object marks of one picture at once.

        Parameters
        ----------
        frame_key : FrameKey
            Picture of the drawings.
        exemplar_indices : Sequence[int]
            Positions of the boxes among the boxes of the picture.
        object_ids : Sequence[int]
            Objects to unmark; those not marked there are skipped.

        Raises
        ------
        IndexError
            If the picture has no box at one of the positions; nothing is removed then.
        """
        on_picture: list[ExemplarBox] = [box for box in self._exemplars if box.frame_key == frame_key]
        for index in exemplar_indices:
            if not 0 <= index < len(on_picture):
                raise IndexError(f"exemplar index must be in [0, {len(on_picture)}). got {index}")
        removed: set[int] = {id(on_picture[index]) for index in exemplar_indices}
        self._exemplars = [box for box in self._exemplars if id(box) not in removed]
        for object_id in object_ids:
            self._marks.pop((frame_key, object_id), None)

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

    def replace(self, prompts: PicturePrompts) -> None:
        """
        Replace every drawing, e.g. with the drawings remembered from the last session, and forget the edit steps.

        Parameters
        ----------
        prompts : PicturePrompts
            New drawings.
        """
        self._load(prompts)
        self._history.clear()

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
        self._load(self.prompts.with_class_renamed(old_name, new_name))
        self._history.revise(lambda state: state.with_class_renamed(old_name, new_name))

    def retain_classes(self, class_names: Sequence[str]) -> None:
        """
        Remove the drawings of classes that no longer exist.

        Parameters
        ----------
        class_names : Sequence[str]
            Current class names.
        """
        kept: tuple[str, ...] = tuple(class_names)
        self._load(self.prompts.with_classes(kept))
        self._history.revise(lambda state: state.with_classes(kept))

    def _load(self, prompts: PicturePrompts) -> None:
        self._exemplars = list(prompts.exemplars)
        self._marks = {(mark.frame_key, mark.object_id): mark for mark in prompts.marks}

    def _restore(self, path: Path, drawings: PicturePrompts) -> None:
        self._exemplars = [box for box in self._exemplars if box.frame_key.path != path] + list(drawings.exemplars)
        self._marks = {identity: mark for identity, mark in self._marks.items() if mark.frame_key.path != path}
        self._marks.update({(mark.frame_key, mark.object_id): mark for mark in drawings.marks})
