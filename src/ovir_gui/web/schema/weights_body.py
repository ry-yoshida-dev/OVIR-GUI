from pydantic import BaseModel


class WeightsBody(BaseModel):
    """
    Downloaded weights of a preset of the current task.

    Attributes
    ----------
    weights_path : str
        Weights path of the preset, e.g. ``"google/owlv2-base-patch16"``.
    """

    weights_path: str
