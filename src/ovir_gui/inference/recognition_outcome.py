from dataclasses import dataclass

from ..recognition import FrameResult


@dataclass(frozen=True, eq=False)
class RecognitionOutcome:
    """
    Results of one mini-batch with what it cost.

    Attributes
    ----------
    results : tuple[FrameResult, ...]
        One result per image, in input order.
    inference_seconds : float
        Time spent in the model, loading excluded.
    is_model_reloaded : bool
        Whether the model was loaded for this mini-batch.
    """

    results: tuple[FrameResult, ...]
    inference_seconds: float
    is_model_reloaded: bool
