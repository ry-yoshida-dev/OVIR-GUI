from dataclasses import dataclass

from .video_info import VideoInfo


@dataclass(frozen=True)
class VideoSampling:
    """
    Which frames of a video are recognized: every ``frame_step``-th frame from the first.

    Changing the step keeps the results of every frame recognized before; frames off the new grid are only no longer
    expected.

    Attributes
    ----------
    frame_step : int
        Distance between sampled frames; ``1`` samples every frame.

    Raises
    ------
    ValueError
        If the step is not positive.
    """

    frame_step: int = 30

    def __post_init__(self) -> None:
        if self.frame_step <= 0:
            raise ValueError(f"frame_step must be positive. got {self.frame_step}")

    def frame_indices(self, video: VideoInfo) -> tuple[int, ...]:
        """
        Sampled frames of a video.

        Parameters
        ----------
        video : VideoInfo
            Stream properties.

        Returns
        -------
        tuple[int, ...]
            Frame indices in order.
        """
        return tuple(range(0, video.frame_count, self.frame_step))

    def is_sampled(self, frame_index: int) -> bool:
        """
        Whether a frame lies on the sampling grid.

        Parameters
        ----------
        frame_index : int
            Zero-based frame index.

        Returns
        -------
        bool
            True for multiples of the step.
        """
        return frame_index % self.frame_step == 0

    def describe(self, video: VideoInfo) -> str:
        """
        The sampling interval in frames and seconds.

        Parameters
        ----------
        video : VideoInfo
            Stream properties giving the frame rate.

        Returns
        -------
        str
            E.g. ``"every 30 frames (1.00 s)"``.
        """
        if self.frame_step == 1:
            return "every frame"
        return f"every {self.frame_step} frames ({self.frame_step / video.fps:.2f} s)"
