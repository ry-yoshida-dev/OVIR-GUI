import numpy as np
from geometry import Box2DFormat, Boxes2D
from open_vocabulary_detector import Prompt, PromptQuery, TextQuery, VisualQuery, VisualReference

from ..prompting import LabeledPrompt, VisualExample


class DetectorPromptBuilder:
    """
    Turns a ``LabeledPrompt`` into the prompt of ``open_vocabulary_detector``, also used by the segmenters.

    A visual example becomes one visual query whose reference holds every box of the example. The query of an
    unchanged example is reused, so the detector finds its embedding in its cache; queries of examples no longer
    prompted are forgotten. A class queried by exemplar boxes alone gets its name as the one text query, which SAM 3
    ignores where the boxes define the class.
    """

    def __init__(self) -> None:
        self._queries: dict[VisualExample, VisualQuery] = {}

    def build(self, prompt: LabeledPrompt) -> Prompt:
        """
        Library prompt of the classes.

        Parameters
        ----------
        prompt : LabeledPrompt
            Classes with their phrases and visual examples.

        Returns
        -------
        Prompt
            Prompt whose queries follow ``prompt.prompt_labels``.
        """
        used_queries: dict[VisualExample, VisualQuery] = {}
        class_queries: dict[str, tuple[PromptQuery, ...]] = {}
        for prompt_class in prompt.classes:
            queries: list[PromptQuery] = [TextQuery(phrase) for phrase in prompt_class.phrases]
            if prompt_class.is_exemplar_only:
                queries.append(TextQuery(prompt_class.name))
            for example in prompt_class.visual_examples:
                query: VisualQuery = self._queries.get(example) or self._query_of(example)
                used_queries[example] = query
                queries.append(query)
            class_queries[prompt_class.name] = tuple(queries)
        self._queries = used_queries
        return Prompt(class_queries)

    @staticmethod
    def _query_of(example: VisualExample) -> VisualQuery:
        boxes: Boxes2D = Boxes2D.register(
            value=np.array(example.boxes, dtype=np.float64).reshape(-1, 4), box2d_format=Box2DFormat.XYXY
        )
        return VisualQuery(references=(VisualReference(image=example.pixels, boxes=boxes),))
