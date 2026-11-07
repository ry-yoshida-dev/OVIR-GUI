from pydantic import BaseModel


class ReferenceBoxesBody(BaseModel):
    """
    Boxes drawn on a reference draft for one class.

    Attributes
    ----------
    draft_id : str
        Draft of the reference image.
    class_index : int
        Class the boxes show.
    boxes : list[list[float]]
        Boxes ``[left, top, right, bottom]``; empty uses the whole image.
    """

    draft_id: str
    class_index: int
    boxes: list[list[float]]
