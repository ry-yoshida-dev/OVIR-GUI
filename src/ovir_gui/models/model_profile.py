import hashlib
import json
from dataclasses import dataclass, field

from ..prompting import QueryKind
from ..recognition import RecognitionTask
from .profile_option import ProfileOption


@dataclass(frozen=True)
class ModelProfile:
    """
    Model and options a result was recognized with; results of equal profiles replace each other, results of other
    profiles are kept side by side for comparison.

    Batch size is not part of the profile, since it does not change results.

    Attributes
    ----------
    task : RecognitionTask
        Task of the model.
    backend : str
        Model family.
    model_name : str
        Preset name.
    weights_path : str
        Checkpoint the model loads.
    device : str
        Device requested.
    precision : str
        Short name of the precision, e.g. ``"fp32"``.
    options : tuple[ProfileOption, ...]
        Task-specific settings, e.g. thresholds or pooling.
    query_kinds : frozenset[QueryKind]
        Query kinds the model accepts, deciding which edits of the classes make its results outdated.
    """

    task: RecognitionTask
    backend: str
    model_name: str
    weights_path: str
    device: str
    precision: str
    options: tuple[ProfileOption, ...]
    query_kinds: frozenset[QueryKind] = field(default=frozenset({QueryKind.TEXT}), compare=False)

    @property
    def key(self) -> str:
        """
        Stable text naming the profile, e.g. in the browser and the results archive.

        Returns
        -------
        str
            First 16 hexadecimal digits of the SHA-256 of every field.
        """
        fields: list[str | list[str]] = [
            self.task.value,
            self.backend,
            self.model_name,
            self.weights_path,
            self.device,
            self.precision,
            *([option.name, option.value] for option in self.options),
        ]
        return hashlib.sha256(json.dumps(fields).encode()).hexdigest()[:16]

    @property
    def label(self) -> str:
        """
        Backend and model name.

        Returns
        -------
        str
            ``"<backend>/<model>"``.
        """
        return f"{self.backend}/{self.model_name}"

    @property
    def options_text(self) -> str:
        """
        Device, precision and options in one line.

        Returns
        -------
        str
            E.g. ``"auto · fp32 · Conf 0.35 · NMS off"``.
        """
        parts: list[str] = [self.device, self.precision, *(f"{option.name} {option.value}" for option in self.options)]
        return " · ".join(parts)

    def option_value(self, name: str) -> str:
        """
        Value of one option.

        Parameters
        ----------
        name : str
            Option name.

        Returns
        -------
        str
            Its value, or an empty string when the profile has no such option.
        """
        return next((option.value for option in self.options if option.name == name), "")
