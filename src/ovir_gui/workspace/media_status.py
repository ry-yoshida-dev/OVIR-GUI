from dataclasses import dataclass

from .media_state import MediaState


@dataclass(frozen=True)
class MediaStatus:
    """
    Recognition state of one open image or video with the shown model.

    Attributes
    ----------
    state : MediaState
        Overall state.
    expected_count : int
        Pictures that are recognized: 1 for an image, the sampled frames of a video.
    recognized_count : int
        Expected pictures with an up-to-date result.
    outdated_count : int
        Pictures recognized with other classes.
    failed_count : int
        Pictures whose recognition failed.
    kept_count : int
        Kept findings over the recognized pictures, after rejections and class minimums.
    """

    state: MediaState
    expected_count: int
    recognized_count: int
    outdated_count: int
    failed_count: int
    kept_count: int

    @property
    def description(self) -> str:
        """
        One line for the tool tip of the media list.

        Returns
        -------
        str
            E.g. ``"12/40 frames inferred · 3 outdated"``.
        """
        if self.expected_count == 1:
            text: str = {
                MediaState.NOT_ANALYZED: "Not inferred",
                MediaState.PARTIAL: "Inferred",
                MediaState.DONE: "Inferred",
                MediaState.OUTDATED: "Inferred with other classes",
                MediaState.FAILED: "Inference failed",
            }[self.state]
            return text
        parts: list[str] = [f"{self.recognized_count}/{self.expected_count} frames inferred"]
        if self.outdated_count:
            parts.append(f"{self.outdated_count} outdated")
        if self.failed_count:
            parts.append(f"{self.failed_count} failed")
        return " · ".join(parts)
