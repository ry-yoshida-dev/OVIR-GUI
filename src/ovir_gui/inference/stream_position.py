from pathlib import Path

from ..media import FrameKey
from ..prompting import LabeledPrompt


class StreamPosition:
    """
    Last picture fed to a tracking stream, telling whether the next picture continues the same stream.

    A stream continues with a later frame of the same video recognized for the same prompt; anything else, an image,
    an earlier frame, another video or another run, starts a new stream.
    """

    def __init__(self) -> None:
        self._path: Path | None = None
        self._frame_index: int | None = None
        self._prompt: LabeledPrompt | None = None

    def is_continued_by(self, frame_key: FrameKey, prompt: LabeledPrompt) -> bool:
        """
        Whether a picture is the next frame of the current stream.

        Parameters
        ----------
        frame_key : FrameKey
            Picture about to be tracked.
        prompt : LabeledPrompt
            Prompt of its run, compared by identity.

        Returns
        -------
        bool
            True for a later frame of the same video recognized with the same prompt.
        """
        return (
            self._prompt is prompt
            and self._path == frame_key.path
            and self._frame_index is not None
            and frame_key.frame_index is not None
            and frame_key.frame_index > self._frame_index
        )

    def advance(self, frame_key: FrameKey, prompt: LabeledPrompt) -> None:
        """
        Remember the picture just fed to the stream.

        Parameters
        ----------
        frame_key : FrameKey
            Tracked picture.
        prompt : LabeledPrompt
            Prompt of its run.
        """
        self._path = frame_key.path
        self._frame_index = frame_key.frame_index
        self._prompt = prompt

    def reset(self) -> None:
        """
        Forget the stream, so the next picture starts a new one.
        """
        self._path = None
        self._frame_index = None
        self._prompt = None
