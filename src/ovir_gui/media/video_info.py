from dataclasses import dataclass
from pathlib import Path

from video_handler import VideoBackend, VideoMetadata, VideoReaderFactory

from ..recognition import ImageSize


@dataclass(frozen=True)
class VideoInfo:
    """
    Stream properties of a video file.

    Attributes
    ----------
    frame_count : int
        Number of frames.
    fps : float
        Average frame rate.
    size : ImageSize
        Frame size in pixels.

    Raises
    ------
    ValueError
        If the video has no frame or no positive frame rate.
    """

    frame_count: int
    fps: float
    size: ImageSize

    def __post_init__(self) -> None:
        if self.frame_count <= 0:
            raise ValueError(f"a video needs at least one frame. got {self.frame_count}")
        if self.fps <= 0:
            raise ValueError(f"fps must be positive. got {self.fps}")

    @classmethod
    def probe(cls, path: Path) -> "VideoInfo":
        """
        Read the stream properties of a video file without decoding its frames.

        Parameters
        ----------
        path : Path
            Video file.

        Returns
        -------
        VideoInfo
            Frame count, frame rate and size.

        Raises
        ------
        FileNotFoundError
            If the file does not exist.
        ValueError
            If the file cannot be opened as a video or reports no frame.
        """
        with VideoReaderFactory(backend=VideoBackend.OPENCV).build(str(path)) as reader:
            metadata: VideoMetadata = reader.metadata
        return cls(
            frame_count=metadata.frame_count,
            fps=metadata.fps if metadata.fps > 0 else 30.0,
            size=ImageSize(width=metadata.width, height=metadata.height),
        )

    @property
    def duration_seconds(self) -> float:
        """
        Length of the video.

        Returns
        -------
        float
            Frame count divided by the frame rate.
        """
        return self.frame_count / self.fps

    def seconds_of(self, frame_index: int) -> float:
        """
        Time of a frame from the start of the video.

        Parameters
        ----------
        frame_index : int
            Zero-based frame index.

        Returns
        -------
        float
            Seconds.
        """
        return frame_index / self.fps

    def timestamp_of(self, frame_index: int) -> str:
        """
        Time of a frame written for people.

        Parameters
        ----------
        frame_index : int
            Zero-based frame index.

        Returns
        -------
        str
            ``m:ss.mmm``, or ``h:mm:ss.mmm`` from an hour on.
        """
        total_milliseconds: int = round(self.seconds_of(frame_index) * 1000)
        hours, remainder = divmod(total_milliseconds, 3_600_000)
        minutes, remainder = divmod(remainder, 60_000)
        seconds, milliseconds = divmod(remainder, 1000)
        if hours:
            return f"{hours}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"
        return f"{minutes}:{seconds:02d}.{milliseconds:03d}"
