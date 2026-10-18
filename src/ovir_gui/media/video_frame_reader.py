import math
from collections.abc import Iterator, Sequence
from itertools import pairwise
from pathlib import Path

import numpy as np
from PIL import Image
from time_series_iterator import IndexBase, VideoBackend, VideoIterationParameters, VideoIterator

from ..recognition.array_types import UInt8Array
from .video_info import VideoInfo


class VideoFrameReader:
    """
    Reads frames of one video file through ``time_series_iterator``.

    Frames are addressed by zero-based index, which is the time id of an iterator with ``IndexBase.ZERO``. Reading
    several frames streams through the video once with the largest stride that reaches every requested frame, skipping
    the frames in between without decoding them, so a sampled video is read at the cost of its samples.
    """

    def __init__(self, path: Path, video: VideoInfo) -> None:
        """
        Parameters
        ----------
        path : Path
            Video file.
        video : VideoInfo
            Stream properties of the file.
        """
        self._path: Path = path
        self._video: VideoInfo = video

    def read(self, frame_indices: Sequence[int]) -> Iterator[tuple[int, Image.Image]]:
        """
        Decode some frames in ascending order.

        Parameters
        ----------
        frame_indices : Sequence[int]
            Frames to read; repeated and out-of-range indices are ignored.

        Yields
        ------
        tuple[int, Image.Image]
            Frame index and RGB pixels of every requested frame the video holds.

        Raises
        ------
        ValueError
            If the video cannot be opened.
        """
        wanted: list[int] = sorted({index for index in frame_indices if 0 <= index < self._video.frame_count})
        if not wanted:
            return
        step: int = self._stride_of(wanted)
        iterator: VideoIterator = VideoIterator(
            paths=[str(self._path)], params=self._parameters(wanted[0], wanted[-1], step)
        )
        wanted_set: frozenset[int] = frozenset(wanted)
        remaining_count: int = len(wanted)
        expected_index: int = wanted[0]
        try:
            while remaining_count:
                if expected_index not in wanted_set:
                    try:
                        iterator.skip()
                    except StopIteration:
                        return
                    expected_index += step
                    continue
                try:
                    time_id, frame = next(iterator)
                except StopIteration:
                    return
                expected_index = time_id + step
                if time_id in wanted_set:
                    remaining_count -= 1
                    yield time_id, self._to_image(frame)
        finally:
            iterator.close()

    def read_one(self, frame_index: int) -> Image.Image:
        """
        Decode a single frame.

        Parameters
        ----------
        frame_index : int
            Zero-based frame index.

        Returns
        -------
        Image.Image
            RGB pixels of the frame.

        Raises
        ------
        ValueError
            If the frame lies outside the video or cannot be decoded.
        """
        if not 0 <= frame_index < self._video.frame_count:
            raise ValueError(f"frame {frame_index} lies outside the {self._video.frame_count} frames.")
        iterator: VideoIterator = VideoIterator(
            paths=[str(self._path)], params=self._parameters(frame_index, frame_index, 1)
        )
        try:
            return self._to_image(iterator.get_image(frame_index))
        finally:
            iterator.close()

    def _parameters(self, first_index: int, last_index: int, step: int) -> VideoIterationParameters:
        return VideoIterationParameters(
            sampling_freq=step,
            raw_sampling_rate=self._video.fps,
            index_base=IndexBase.ZERO,
            start_time_id=first_index,
            end_time_id=last_index if last_index > 0 else -1,
            video_backend=VideoBackend.OPENCV,
        )

    @staticmethod
    def _stride_of(frame_indices: list[int]) -> int:
        stride: int = 0
        for previous, current in pairwise(frame_indices):
            stride = math.gcd(stride, current - previous)
        return max(stride, 1)

    @staticmethod
    def _to_image(frame: object) -> Image.Image:
        pixels: UInt8Array = np.asarray(frame, dtype=np.uint8)
        if pixels.ndim != 3 or pixels.shape[2] != 3:
            raise ValueError(f"expected a (H, W, 3) BGR frame. got shape {pixels.shape}")
        return Image.fromarray(np.ascontiguousarray(pixels[:, :, ::-1]).astype(np.uint8), mode="RGB")
