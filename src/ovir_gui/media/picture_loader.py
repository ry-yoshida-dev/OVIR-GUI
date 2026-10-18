from collections.abc import Generator, Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

from .frame_key import FrameKey
from .loaded_image import LoadedImage
from .media_item import MediaItem
from .video_frame_reader import VideoFrameReader


@dataclass(frozen=True)
class PictureLoader:
    """
    Reads the pixels of images and video frames, streaming each video once for all of its requested frames.

    Attributes
    ----------
    media : dict[Path, MediaItem]
        Open media by path, telling videos apart and giving their stream properties.
    """

    media: dict[Path, MediaItem]

    def load(self, frame_keys: Sequence[FrameKey]) -> Generator[tuple[FrameKey, Image.Image | Exception]]:
        """
        Read pictures in the given order, streaming each ascending run of frames of one video in one pass.

        Parameters
        ----------
        frame_keys : Sequence[FrameKey]
            Images and video frames to read.

        Yields
        ------
        tuple[FrameKey, Image.Image | Exception]
            Each key with its RGB pixels, or the error that kept it from being read. A frame missing from its video
            is reported as ``ValueError``.
        """
        position: int = 0
        while position < len(frame_keys):
            frame_key: FrameKey = frame_keys[position]
            item: MediaItem | None = self.media.get(frame_key.path)
            if frame_key.frame_index is None or item is None or item.video is None:
                yield frame_key, self._load_image(frame_key)
                position += 1
                continue
            end: int = position + 1
            while end < len(frame_keys) and self._continues_run(frame_keys[end - 1], frame_keys[end]):
                end += 1
            yield from self._load_frames(item, frame_keys[position:end])
            position = end

    @staticmethod
    def _continues_run(previous: FrameKey, following: FrameKey) -> bool:
        return (
            following.path == previous.path
            and previous.frame_index is not None
            and following.frame_index is not None
            and following.frame_index > previous.frame_index
        )

    @staticmethod
    def _load_image(frame_key: FrameKey) -> Image.Image | Exception:
        try:
            return LoadedImage.open(frame_key.path).image
        except Exception as error:
            return error

    @staticmethod
    def _load_frames(
        item: MediaItem, frame_keys: Sequence[FrameKey]
    ) -> Iterator[tuple[FrameKey, Image.Image | Exception]]:
        keys_by_index: dict[int, FrameKey] = {key.frame_index: key for key in frame_keys if key.frame_index is not None}
        try:
            for frame_index, image in VideoFrameReader(item.path, item.video_info).read(list(keys_by_index)):
                frame_key: FrameKey | None = keys_by_index.pop(frame_index, None)
                if frame_key is not None:
                    yield frame_key, image
        except Exception as error:
            for frame_key in keys_by_index.values():
                yield frame_key, error
            return
        for frame_key in keys_by_index.values():
            yield frame_key, ValueError(f"{frame_key.label} could not be decoded.")
