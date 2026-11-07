from dataclasses import dataclass

from .lvis_split import LvisSplit


@dataclass(frozen=True)
class ModelBenchmark:
    """
    Accuracy and compute of one checkpoint.

    Attributes
    ----------
    lvis_ap : float | None
        Box AP on LVIS from the paper or model card; ``None`` when not reported.
    lvis_split : LvisSplit | None
        Split ``lvis_ap`` is reported on; ``None`` when not reported.
    is_lvis_zero_shot : bool
        Whether LVIS was kept out of training, so ``lvis_ap`` is zero-shot.
    gflops : float | None
        Theoretical compute of one detection; ``None`` when not measured.
    """

    lvis_ap: float | None = None
    lvis_split: LvisSplit | None = None
    is_lvis_zero_shot: bool = True
    gflops: float | None = None
