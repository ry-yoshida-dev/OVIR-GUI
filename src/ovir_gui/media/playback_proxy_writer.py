import threading
from pathlib import Path
from typing import ClassVar

import numpy as np
import torch
import torchcodec
from PIL import Image
from torch_modules import Device
from video_handler import (
    FrameConverter,
    RGBTensorFrame,
    TorchCodecVideoWriter,
    TorchCodecWriteOptions,
    VideoWriteParameters,
)

from ..ffmpeg import OperatingSystem
from .media_item import MediaItem
from .video_frame_reader import VideoFrameReader


class PlaybackProxyWriter:
    """
    Re-encodes a video the browser cannot decode, such as ProRes or uncompressed footage, into H.264 for playback.

    Every frame is read with the same decoder as recognition and written in order at the source frame rate and size,
    so frame ``i`` of the copy shows frame ``i`` of the source and findings line up with it. ``stop`` aborts the
    encoding in progress and every later one, e.g. when the server quits.
    """

    CODEC: ClassVar[str] = "libx264"
    PIXEL_FORMAT: ClassVar[str] = "yuv420p"
    CONSTANT_RATE_FACTOR: ClassVar[float] = 23.0
    PRESET: ClassVar[str] = "veryfast"

    def __init__(self) -> None:
        self._stop_requested: threading.Event = threading.Event()

    def stop(self) -> None:
        """
        Abort the encoding in progress after its current frame, and refuse later ones; safe to call from any thread.
        """
        self._stop_requested.set()

    def write(self, item: MediaItem, target: Path) -> Path:
        """
        Encode the playback copy of a video.

        Parameters
        ----------
        item : MediaItem
            Open video.
        target : Path
            MP4 file to write; it appears only once complete.

        Returns
        -------
        Path
            ``target``.

        Raises
        ------
        ValueError
            If the item is not a video or holds no decodable frame.
        RuntimeError
            If torchcodec found no FFmpeg when imported.
        InterruptedError
            If ``stop`` was called.
        """
        ffmpeg_major_version: object = vars(torchcodec).get("ffmpeg_major_version")
        if not isinstance(ffmpeg_major_version, int):
            raise RuntimeError(f"FFmpeg was not found. {OperatingSystem.current().ffmpeg_install_hint}")
        video = item.video_info
        partial: Path = target.with_name(f".{target.name}.partial.mp4")
        try:
            with TorchCodecVideoWriter(
                str(partial),
                VideoWriteParameters(fps=video.fps),
                TorchCodecWriteOptions(
                    device=Device.CPU,
                    codec=self.CODEC,
                    pixel_format=self.PIXEL_FORMAT,
                    crf=self.CONSTANT_RATE_FACTOR,
                    preset=self.PRESET,
                ),
            ) as writer:
                reader: VideoFrameReader = VideoFrameReader(item.path, video)
                for _, picture in reader.read(range(video.frame_count)):
                    if self._stop_requested.is_set():
                        raise InterruptedError(f"Encoding the playback copy of {item.path.name} was stopped.")
                    writer.write(self._tensor_of(picture))
                if writer.written_frame_count == 0:
                    raise ValueError(f"{item.path.name} holds no decodable frame.")
            partial.replace(target)
            return target
        finally:
            partial.unlink(missing_ok=True)

    @staticmethod
    def _tensor_of(picture: Image.Image) -> RGBTensorFrame:
        pixels: torch.Tensor = torch.from_numpy(np.array(picture, dtype=np.uint8))
        return FrameConverter.as_rgb_tensor_frame(pixels.permute(2, 0, 1).contiguous())
