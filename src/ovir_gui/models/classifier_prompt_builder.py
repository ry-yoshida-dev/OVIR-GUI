from open_vocabulary_classification import Prompt, PromptQuery, TextQuery, VisualQuery, VisualReference

from ..prompting import LabeledPrompt, VisualExample


class ClassifierPromptBuilder:
    """
    Turns a ``LabeledPrompt`` into the prompt of ``open_vocabulary_classification``.

    A visual example becomes one visual query averaging the crops of its boxes. The query of an unchanged example is
    reused, so the classifier finds the embeddings of its references in its cache; queries of examples no longer
    prompted are forgotten.
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
            Prompt whose queries follow ``prompt.query_labels``.
        """
        used_queries: dict[VisualExample, VisualQuery] = {}
        class_queries: dict[str, tuple[PromptQuery, ...]] = {}
        for prompt_class in prompt.classes:
            queries: list[PromptQuery] = [TextQuery(phrase) for phrase in prompt_class.phrases]
            for example in prompt_class.visual_examples:
                query: VisualQuery = self._queries.get(example) or VisualQuery(
                    tuple(VisualReference(crop) for crop in example.crops())
                )
                used_queries[example] = query
                queries.append(query)
            class_queries[prompt_class.name] = tuple(queries)
        self._queries = used_queries
        return Prompt(class_queries)
