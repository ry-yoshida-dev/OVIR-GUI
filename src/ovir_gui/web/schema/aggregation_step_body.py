from pydantic import BaseModel


class AggregationStepBody(BaseModel):
    """
    One aggregation step of a classifier chosen in the aggregation settings.

    Attributes
    ----------
    unit : str
        Value of what the step merges: ``template``, ``prompt`` or ``template_and_prompt``.
    timing : str
        Value of where the step runs: ``embedding`` (text vectors) or ``similarity``.
    method : str
        Value of how a group becomes one, e.g. ``max``.
    """

    unit: str
    timing: str
    method: str
