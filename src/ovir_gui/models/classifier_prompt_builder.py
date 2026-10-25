from open_vocabulary_classification import Prompt, PromptQuery, TextQuery, VisualQuery, VisualReference

from ..prompting import LabeledPrompt, VisualExample
from .classifier_query_layout import ClassifierQueryLayout
from .prompt_sentence import PromptSentence


class ClassifierPromptBuilder:
    """
    Turns a ``LabeledPrompt`` into the queries an ``open_vocabulary_classification`` classifier scores.

    Every phrase is filled into every text template, giving one sentence each; sentences equal but for case share one
    query. A visual example becomes one visual query averaging the crops of its boxes. The query of an unchanged
    example is reused, so the classifier finds the embeddings of its references in its cache; queries of examples no
    longer prompted are forgotten.
    """

    def __init__(self) -> None:
        self._queries: dict[VisualExample, VisualQuery] = {}

    def build(self, prompt: LabeledPrompt, templates: tuple[str, ...]) -> ClassifierQueryLayout:
        """
        Queries of the classes.

        Parameters
        ----------
        prompt : LabeledPrompt
            Classes with their phrases and visual examples.
        templates : tuple[str, ...]
            Text templates with one ``{}`` each; ``"{}"`` uses a phrase as written.

        Returns
        -------
        ClassifierQueryLayout
            Library prompt with the sentences of every class, whose prompt indices follow ``prompt.prompt_labels``.
        """
        used_queries: dict[VisualExample, VisualQuery] = {}
        queries: list[PromptQuery] = []
        text_query_indices: dict[str, int] = {}
        sentences: list[PromptSentence] = []
        prompt_index: int = 0
        for class_index, prompt_class in enumerate(prompt.classes):
            for phrase in prompt_class.phrases:
                for template in templates:
                    query: TextQuery = TextQuery(template.format(phrase))
                    folded: str = query.text.casefold()
                    if folded not in text_query_indices:
                        text_query_indices[folded] = len(queries)
                        queries.append(query)
                    sentences.append(PromptSentence(class_index, prompt_index, template, text_query_indices[folded]))
                prompt_index += 1
            for example in prompt_class.visual_examples:
                visual_query: VisualQuery = self._queries.get(example) or VisualQuery(
                    tuple(VisualReference(crop) for crop in example.crops())
                )
                used_queries[example] = visual_query
                sentences.append(PromptSentence(class_index, prompt_index, None, len(queries)))
                queries.append(visual_query)
                prompt_index += 1
        self._queries = used_queries
        return ClassifierQueryLayout(
            prompt=Prompt({str(index): (query,) for index, query in enumerate(queries)}),
            sentences=tuple(sentences),
            class_names=tuple(prompt_class.name for prompt_class in prompt.classes),
        )
