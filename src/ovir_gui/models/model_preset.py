from dataclasses import dataclass
from importlib.resources.abc import Traversable

from omegaconf import DictConfig, ListConfig, OmegaConf

from ..recognition import RecognitionTask


@dataclass(frozen=True)
class ModelPreset:
    """
    YAML preset of one model shipped with a model library.

    Attributes
    ----------
    task : RecognitionTask
        Task of the library the preset belongs to.
    backend : str
        Model family, the name of the preset's directory, e.g. ``"grounding_dino"``.
    name : str
        Preset name, e.g. ``"original_tiny"``.
    source : Traversable
        YAML file holding the preset.
    """

    task: RecognitionTask
    backend: str
    name: str
    source: Traversable

    @property
    def label(self) -> str:
        """
        Name of the preset within its task.

        Returns
        -------
        str
            ``"<backend>/<name>"``.
        """
        return f"{self.backend}/{self.name}"

    def read_section(self, section_key: str) -> DictConfig:
        """
        Read one top-level section of the preset.

        Parameters
        ----------
        section_key : str
            Section name, e.g. ``"detector"``.

        Returns
        -------
        DictConfig
            Content of the section.

        Raises
        ------
        KeyError
            If the file has no such section.
        TypeError
            If the section is not a mapping.
        """
        config: DictConfig | ListConfig = OmegaConf.create(self.source.read_text(encoding="utf-8"))
        if not isinstance(config, DictConfig) or section_key not in config:
            raise KeyError(f"{self.label}: missing '{section_key}' section")
        section: object = config[section_key]
        if not isinstance(section, DictConfig):
            raise TypeError(f"{self.label}: '{section_key}' must be a mapping")
        return section
