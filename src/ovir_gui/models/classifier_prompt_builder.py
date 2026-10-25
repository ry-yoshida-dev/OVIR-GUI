from open_vocabulary_classification import Prompt, PromptQuery, TextQuery, VisualQuery, VisualReference

from ..prompting import LabeledPrompt, VisualExample
from .classifier_query_layout import ClassifierQueryLayout


class ClassifierPromptBuilder:
    """
    Turns a ``LabeledPrompt`` into the prompt an ``open_vocabulary_classification`` classifier scores.

    Every class keeps its phrases and visual examples; the classifier fills the phrases into its text templates and
    aggregates them. Phrases of a class equal but for case are one query. A visual example becomes one visual query
    averaging the crops of its boxes. The query of an unchanged example is reused, so the classifier finds the
    embeddings of its references in its cache; queries of examples no longer prompted are forgotten.
    """

    def __init__(self) -> None:
        self._queries: dict[VisualExample, VisualQuery] = {}

    def build(self, prompt: LabeledPrompt) -> ClassifierQueryLayout:
        """
        Queries of the classes.

        Parameters
        ----------
        prompt : LabeledPrompt
            Classes with their phrases and visual examples.

        Returns
        -------
        ClassifierQueryLayout
            Library prompt whose queries name their positions in ``prompt.prompt_labels``.

        Raises
        ------
        ValueError
            If a phrase is a prompt of two classes.
        """
        used_queries: dict[VisualExample, VisualQuery] = {}
        class_queries: dict[str, tuple[PromptQuery, ...]] = {}
        query_prompt_indices: list[int] = []
        prompt_index: int = 0
        for prompt_class in prompt.classes:
            queries: list[PromptQuery] = []
            folded_phrases: set[str] = set()
            for phrase in prompt_class.phrases:
                query: TextQuery = TextQuery(phrase)
                if query.text.casefold() not in folded_phrases:
                    folded_phrases.add(query.text.casefold())
                    queries.append(query)
                    query_prompt_indices.append(prompt_index)
                prompt_index += 1
            for example in prompt_class.visual_examples:
                visual_query: VisualQuery = self._queries.get(example) or VisualQuery(
                    tuple(VisualReference(crop) for crop in example.crops())
                )
                used_queries[example] = visual_query
                queries.append(visual_query)
                query_prompt_indices.append(prompt_index)
                prompt_index += 1
            class_queries[prompt_class.name] = tuple(queries)
        self._queries = used_queries
        return ClassifierQueryLayout(prompt=Prompt(class_queries), query_prompt_indices=tuple(query_prompt_indices))
