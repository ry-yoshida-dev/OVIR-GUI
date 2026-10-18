from dataclasses import dataclass
from pathlib import Path

from ..recognition import ImageSize
from .frame_key import FrameKey
from .media_kind import MediaKind
from .video_info import VideoInfo
from .video_sampling import VideoSampling


@dataclass(frozen=True)
class MediaItem:
    """
    Open media file: an image, or a video with its stream properties.

    Attributes
    ----------
    path : Path
        Resolved media file.
    kind : MediaKind
        Image or video.
    video : VideoInfo | None
        Stream properties of a video; ``None`` for an image.

    Raises
    ------
    ValueError
        If a video lacks its stream properties or an image has some.
    """

    path: Path
    kind: MediaKind
    video: VideoInfo | None = None

    def __post_init__(self) -> None:
        match self.kind:
            case MediaKind.IMAGE:
                if self.video is not None:
                    raise ValueError(f"image {self.path.name} has no video properties.")
            case MediaKind.VIDEO:
                if self.video is None:
                    raise ValueError(f"video {self.path.name} needs its video properties.")

    @classmethod
    def image(cls, path: Path) -> "MediaItem":
        """
        Media item of an image file.

        Parameters
        ----------
        path : Path
            Image file.

        Returns
        -------
        MediaItem
            Image item.
        """
        return cls(path=path, kind=MediaKind.IMAGE)

    @classmethod
    def open(cls, path: Path) -> "MediaItem":
        """
        Media item of a supported file, probing a video for its stream properties.

        Parameters
        ----------
        path : Path
            Image or video file.

        Returns
        -------
        MediaItem
            Item of the file.

        Raises
        ------
        ValueError
            If the file has an unsupported suffix or a video cannot be read.
        FileNotFoundError
            If a video file does not exist.
        """
        kind: MediaKind | None = MediaKind.of_path(path)
        match kind:
            case None:
                raise ValueError(f"{path.name} is neither an image nor a video file.")
            case MediaKind.IMAGE:
                return cls.image(path)
            case MediaKind.VIDEO:
                return cls(path=path, kind=MediaKind.VIDEO, video=VideoInfo.probe(path))

    @property
    def is_video(self) -> bool:
        """
        Whether the item is a video.

        Returns
        -------
        bool
            True for a video.
        """
        return self.kind is MediaKind.VIDEO

    @property
    def video_info(self) -> VideoInfo:
        """
        Stream properties of a video.

        Returns
        -------
        VideoInfo
            Properties read when the video was opened.

        Raises
        ------
        ValueError
            If the item is an image.
        """
        if self.video is None:
            raise ValueError(f"{self.path.name} is not a video.")
        return self.video

    @property
    def frame_size(self) -> ImageSize | None:
        """
        Frame size of a video.

        Returns
        -------
        ImageSize | None
            ``None`` for an image, whose size is read from its file.
        """
        return None if self.video is None else self.video.size

    def frame_keys(self, sampling: VideoSampling) -> tuple[FrameKey, ...]:
        """
        Pictures of the item that are recognized.

        Parameters
        ----------
        sampling : VideoSampling
            Which frames of a video are recognized.

        Returns
        -------
        tuple[FrameKey, ...]
            The image, or every sampled frame of the video in order.
        """
        if self.video is None:
            return (FrameKey(self.path),)
        return tuple(FrameKey(self.path, frame_index) for frame_index in sampling.frame_indices(self.video))

    def key_at(self, frame_index: int | None) -> FrameKey:
        """
        Key of the image, or of one frame of the video.

        Parameters
        ----------
        frame_index : int | None
            Frame of a video, clamped to its frames; ignored for an image.

        Returns
        -------
        FrameKey
            Key of the picture.
        """
        if self.video is None:
            return FrameKey(self.path)
        index: int = 0 if frame_index is None else min(max(0, frame_index), self.video.frame_count - 1)
        return FrameKey(self.path, index)
