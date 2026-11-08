from collections.abc import Callable
from pathlib import Path

from .snapshot import PicturePrompts


class EditHistory:
    """
    Earlier and undone drawings of each media file, so edits are stepped back and forth one at a time.

    Each media file keeps its own steps: undoing on one image never changes another, and a video steps back through
    the edits of all its frames.
    """

    STEP_LIMIT: int = 200

    def __init__(self) -> None:
        self._earlier: dict[Path, list[PicturePrompts]] = {}
        self._undone: dict[Path, list[PicturePrompts]] = {}

    def record(self, path: Path, before: PicturePrompts) -> None:
        """
        Remember the drawings of a file as they were before an edit, and forget the edits undone there.

        Parameters
        ----------
        path : Path
            Image or video file that was edited.
        before : PicturePrompts
            Drawings of the file before the edit.
        """
        steps: list[PicturePrompts] = self._earlier.setdefault(path, [])
        steps.append(before)
        del steps[: -self.STEP_LIMIT]
        self._undone.pop(path, None)

    def can_undo(self, path: Path) -> bool:
        """
        Whether a file has an edit to undo.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        bool
            True when an earlier state is remembered.
        """
        return bool(self._earlier.get(path))

    def can_redo(self, path: Path) -> bool:
        """
        Whether a file has an undone edit to apply again.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        bool
            True when an undone state is remembered.
        """
        return bool(self._undone.get(path))

    def undo(self, path: Path, current: PicturePrompts) -> PicturePrompts:
        """
        Step a file back to its drawings before the last edit.

        Parameters
        ----------
        path : Path
            Image or video file.
        current : PicturePrompts
            Drawings of the file now, kept for redoing.

        Returns
        -------
        PicturePrompts
            Drawings to restore.

        Raises
        ------
        IndexError
            If the file has no edit to undo.
        """
        if not self.can_undo(path):
            raise IndexError(f"nothing to undo on {path.name}.")
        self._undone.setdefault(path, []).append(current)
        return self._earlier[path].pop()

    def redo(self, path: Path, current: PicturePrompts) -> PicturePrompts:
        """
        Apply the last undone edit of a file again.

        Parameters
        ----------
        path : Path
            Image or video file.
        current : PicturePrompts
            Drawings of the file now, kept for undoing.

        Returns
        -------
        PicturePrompts
            Drawings to restore.

        Raises
        ------
        IndexError
            If the file has no undone edit.
        """
        if not self.can_redo(path):
            raise IndexError(f"nothing to redo on {path.name}.")
        self._earlier.setdefault(path, []).append(current)
        return self._undone[path].pop()

    def revise(self, change: Callable[[PicturePrompts], PicturePrompts]) -> None:
        """
        Apply a change made outside the drawing edits, such as a class rename, to every remembered state, so stepping
        back never brings back a class name that no longer exists.

        Parameters
        ----------
        change : Callable[[PicturePrompts], PicturePrompts]
            Same change as applied to the current drawings.
        """
        for states in (*self._earlier.values(), *self._undone.values()):
            states[:] = [change(state) for state in states]

    def clear(self) -> None:
        """
        Forget every step, e.g. when the drawings are replaced by those of another session.
        """
        self._earlier.clear()
        self._undone.clear()
