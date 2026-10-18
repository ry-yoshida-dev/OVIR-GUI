from dataclasses import dataclass

from ..recognition.array_types import UInt8Array
from .json_fields import JsonValue


@dataclass(frozen=True, eq=False)
class ResultsSnapshot:
    """
    Every stored result converted for writing, detached from the live results so it can be written on another thread.

    Attributes
    ----------
    manifest : dict[str, JsonValue]
        Profiles, media, pictures with their findings, rejections and prompt signatures.
    mask_bits : tuple[UInt8Array, ...]
        Packed bits of every instance mask, indexed by the ``mask`` field of the instances.
    """

    manifest: dict[str, JsonValue]
    mask_bits: tuple[UInt8Array, ...]
