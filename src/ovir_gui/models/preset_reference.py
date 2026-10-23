from dataclasses import dataclass

from ..recognition import RecognitionTask


@dataclass(frozen=True)
class PresetReference:
    """
    Names one preset of the catalog.

    Attributes
    ----------
    task : RecognitionTask
        Task of the preset.
    backend : str
        Model family.
    preset_name : str
        Preset name within the family.
    """

    task: RecognitionTask
    backend: str
    preset_name: str
