import io
import os
from collections import OrderedDict
from collections.abc import Callable
from pathlib import Path
from threading import Lock
from typing import ClassVar

from PIL import Image

from ..media import LoadedImage, MediaItem, VideoFrameReader
from .image_preview import ImagePreview
from .picture_info import PictureInfo


class PicturePreviewCache:
    """
    Images and video frames encoded as JPEG for the browser, which cannot display every format the models read.

    Pictures are downscaled when larger than the limit and the latest ones are kept in memory, so stepping back and
    forth through a video does not decode its frames again. Findings stay in pixels of the full picture; the browser
    scales them with the picture size. Safe to use from several threads.
    """

    IMAGE_MAX_SIDE: ClassVar[int] = 4096
    FRAME_MAX_SIDE: ClassVar[int] = 1920
    CAPACITY: ClassVar[int] = 96
    JPEG_QUALITY: ClassVar[int] = 88
    TRANSPOSING_ORIENTATIONS: ClassVar[frozenset[int]] = frozenset({5, 6, 7, 8})
    ORIENTATION_TAG: ClassVar[int] = 0x0112

    def __init__(self) -> None:
        self._lock: Lock = Lock()
        self._previews: OrderedDict[tuple[Path, str, int], ImagePreview] = OrderedDict()
        self._infos: dict[Path, PictureInfo] = {}

    @staticmethod
    def version_of(path: Path) -> str:
        """
        Version of a file.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        str
            Modification time in nanoseconds and size in bytes.

        Raises
        ------
        OSError
            If the file cannot be inspected.
        """
        status: os.stat_result = path.stat()
        return f"{status.st_mtime_ns}-{status.st_size}"

    def info_of(self, path: Path) -> PictureInfo:
        """
        Version and upright size of an image file.

        Parameters
        ----------
        path : Path
            Image file.

        Returns
        -------
        PictureInfo
            Info read from the file header, remembered until the file changes.

        Raises
        ------
        OSError
            If the file cannot be read as an image.
        """
        version: str = self.version_of(path)
        with self._lock:
            cached: PictureInfo | None = self._infos.get(path)
        if cached is not None and cached.version == version:
            return cached
        with Image.open(path) as image:
            width, height = image.size
            orientation: object = image.getexif().get(self.ORIENTATION_TAG)
        if isinstance(orientation, int) and orientation in self.TRANSPOSING_ORIENTATIONS:
            width, height = height, width
        info: PictureInfo = PictureInfo(version=version, width=width, height=height)
        with self._lock:
            self._infos[path] = info
        return info

    def image_preview(self, path: Path) -> ImagePreview:
        """
        Encoded upright image.

        Parameters
        ----------
        path : Path
            Image file.

        Returns
        -------
        ImagePreview
            JPEG at most ``IMAGE_MAX_SIDE`` pixels on its longer side.

        Raises
        ------
        OSError
            If the file cannot be read as an image.
        """
        return self._cached(
            (path, self.version_of(path), -1), lambda: LoadedImage.open(path).image, self.IMAGE_MAX_SIDE
        )

    def frame_preview(self, item: MediaItem, frame_index: int) -> ImagePreview:
        """
        Encoded video frame.

        Parameters
        ----------
        item : MediaItem
            Open video.
        frame_index : int
            Zero-based frame.

        Returns
        -------
        ImagePreview
            JPEG at most ``FRAME_MAX_SIDE`` pixels on its longer side.

        Raises
        ------
        ValueError
            If the frame cannot be decoded.
        """
        reader: VideoFrameReader = VideoFrameReader(item.path, item.video_info)
        return self._cached(
            (item.path, self.version_of(item.path), frame_index),
            lambda: reader.read_one(frame_index),
            self.FRAME_MAX_SIDE,
        )

    def _cached(self, key: tuple[Path, str, int], load: Callable[[], Image.Image], max_side: int) -> ImagePreview:
        with self._lock:
            cached: ImagePreview | None = self._previews.get(key)
            if cached is not None:
                self._previews.move_to_end(key)
                return cached
        preview: ImagePreview = self.encode(load(), max_side)
        with self._lock:
            self._previews[key] = preview
            while len(self._previews) > self.CAPACITY:
                self._previews.popitem(last=False)
        return preview

    @classmethod
    def encode(cls, image: Image.Image, max_side: int | None = None) -> ImagePreview:
        """
        Encode pixels as JPEG.

        Parameters
        ----------
        image : Image.Image
            RGB pixels.
        max_side : int | None, optional
            Longest side of the encoded image; ``IMAGE_MAX_SIDE`` by default.

        Returns
        -------
        ImagePreview
            JPEG of the image, downscaled when larger than ``max_side``.
        """
        limit: int = cls.IMAGE_MAX_SIDE if max_side is None else max_side
        encoded: Image.Image = image.convert("RGB")
        if max(encoded.size) > limit:
            encoded = encoded.copy()
            encoded.thumbnail((limit, limit))
        buffer: io.BytesIO = io.BytesIO()
        encoded.save(buffer, format="JPEG", quality=cls.JPEG_QUALITY)
        return ImagePreview(content=buffer.getvalue(), media_type="image/jpeg")
