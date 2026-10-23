from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import ClassVar

from PIL import Image

from ..media import FrameKey, MediaItem, PictureLoader


class PictureFiles:
    """
    Image file of every exported picture: the image itself, or a JPEG written for a video frame.

    Frames are written to ``frames/<video stem>/<video stem>_f<frame>.jpg`` under the output directory, read in one
    pass per video.
    """

    FRAME_DIRECTORY_NAME: ClassVar[str] = "frames"
    JPEG_QUALITY: ClassVar[int] = 92

    def __init__(self, output_directory: Path, media: Mapping[Path, MediaItem]) -> None:
        """
        Parameters
        ----------
        output_directory : Path
            Directory of the export.
        media : Mapping[Path, MediaItem]
            Open media, telling videos apart.
        """
        self._output_directory: Path = output_directory
        self._media: Mapping[Path, MediaItem] = media
        self._paths: dict[FrameKey, Path] = {}
        self._written_paths: list[Path] = []

    @property
    def written_paths(self) -> tuple[Path, ...]:
        """
        Frame images written so far.

        Returns
        -------
        tuple[Path, ...]
            Files in writing order.
        """
        return tuple(self._written_paths)

    def prepare(self, frame_keys: Sequence[FrameKey]) -> None:
        """
        Write the frames of videos among some pictures.

        Parameters
        ----------
        frame_keys : Sequence[FrameKey]
            Exported pictures.

        Raises
        ------
        OSError
            If a frame cannot be written.
        """
        frames: list[FrameKey] = sorted(
            (key for key in frame_keys if key.frame_index is not None and key not in self._paths),
            key=FrameKey.sort_key,
        )
        for frame_key in frame_keys:
            if frame_key.frame_index is None:
                self._paths[frame_key] = frame_key.path
        for loaded in PictureLoader(dict(self._media)).load(frames):
            picture: Image.Image | Exception = loaded.image_or_error
            if isinstance(picture, Exception):
                continue
            self._paths[loaded.frame_key] = self._write_frame(loaded.frame_key, picture)

    def path_of(self, frame_key: FrameKey) -> Path | None:
        """
        Image file of a picture.

        Parameters
        ----------
        frame_key : FrameKey
            Exported picture.

        Returns
        -------
        Path | None
            ``None`` when a frame could not be read.
        """
        return self._paths.get(frame_key)

    def frame_path_of(self, frame_key: FrameKey) -> Path:
        """
        Where the image of a video frame is written.

        Parameters
        ----------
        frame_key : FrameKey
            Video frame.

        Returns
        -------
        Path
            ``frames/<stem>/<stem>_f<frame>.jpg`` under the output directory.
        """
        stem: str = frame_key.path.stem
        frame_index: int = frame_key.frame_index or 0
        return self._output_directory / self.FRAME_DIRECTORY_NAME / stem / f"{stem}_f{frame_index:06d}.jpg"

    def _write_frame(self, frame_key: FrameKey, picture: Image.Image) -> Path:
        target: Path = self.frame_path_of(frame_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        picture.save(target, quality=self.JPEG_QUALITY)
        self._written_paths.append(target)
        return target
