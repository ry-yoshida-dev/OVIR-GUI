from collections.abc import Iterable
from pathlib import Path

from pydantic import BaseModel

from ...media import FrameKey


class PictureFindings(BaseModel):
    """
    Findings of one picture.

    Attributes
    ----------
    path : str
        Media file.
    frame : int | None
        Frame of a video; ``None`` for an image.
    indices : list[int]
        Findings of the picture's result.
    """

    path: str
    frame: int | None
    indices: list[int]

    @property
    def frame_key(self) -> FrameKey:
        """
        Picture of the findings.

        Returns
        -------
        FrameKey
            Key of ``path`` and ``frame``.
        """
        return FrameKey(Path(self.path), self.frame)

    @staticmethod
    def grouped(groups: Iterable["PictureFindings"]) -> dict[FrameKey, list[int]]:
        """
        Findings of some groups gathered by picture.

        Parameters
        ----------
        groups : Iterable[PictureFindings]
            Groups, possibly naming a picture more than once.

        Returns
        -------
        dict[FrameKey, list[int]]
            Indices of every picture in group order, pictures in the order they first appear.
        """
        indices: dict[FrameKey, list[int]] = {}
        for group in groups:
            indices.setdefault(group.frame_key, []).extend(group.indices)
        return indices
