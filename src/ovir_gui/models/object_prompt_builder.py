from open_vocabulary_segmentation import ObjectPrompt, PromptElement

from ..prompting import ObjectMark


class ObjectPromptBuilder:
    """
    Turns an ``ObjectMark`` into the ``ObjectPrompt`` of ``open_vocabulary_segmentation``.

    Elements the model does not accept are left out, e.g. the points of a mark for Florence-2, which takes boxes only;
    a mark left without anything marking its object is skipped.
    """

    def __init__(self, supported_elements: frozenset[PromptElement]) -> None:
        """
        Parameters
        ----------
        supported_elements : frozenset[PromptElement]
            Prompt elements the model accepts.
        """
        self._supported_elements: frozenset[PromptElement] = supported_elements

    @property
    def is_point_supported(self) -> bool:
        """
        Whether points reach the model.

        Returns
        -------
        bool
            True when the model accepts points.
        """
        return PromptElement.POINT in self._supported_elements

    def build(self, mark: ObjectMark) -> ObjectPrompt | None:
        """
        Library prompt of one mark.

        Parameters
        ----------
        mark : ObjectMark
            Points and box of one object.

        Returns
        -------
        ObjectPrompt | None
            Prompt with the accepted elements; ``None`` when nothing accepted marks the object.
        """
        is_box_supported: bool = PromptElement.BOX in self._supported_elements
        box: tuple[float, float, float, float] | None = mark.box if is_box_supported else None
        positive_points: tuple[tuple[float, float], ...] = mark.positive_points if self.is_point_supported else ()
        negative_points: tuple[tuple[float, float], ...] = mark.negative_points if self.is_point_supported else ()
        if box is None and not positive_points:
            return None
        return ObjectPrompt.from_coordinates(
            positive_points=positive_points, negative_points=negative_points, box_xyxy=box
        )
