from pydantic import BaseModel


class PresetBody(BaseModel):
    """
    Preset of the current task chosen with its own values.

    Attributes
    ----------
    backend : str
        Model family.
    preset_name : str
        Preset name within the backend.
    """

    backend: str
    preset_name: str
