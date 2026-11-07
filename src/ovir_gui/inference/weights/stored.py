from dataclasses import dataclass


@dataclass(frozen=True)
class StoredWeights:
    """
    Downloaded weights of one checkpoint on this computer.

    Attributes
    ----------
    weights_path : str
        Weights path of the checkpoint, e.g. ``"google/owlv2-base-patch16"`` or ``"yoloe-11l-seg.pt"``.
    size_bytes : int
        Disk space the downloaded files take.
    """

    weights_path: str
    size_bytes: int
