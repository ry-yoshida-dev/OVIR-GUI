from typing import ClassVar

from open_vocabulary_classification import TextTemplates

from ..models import ModelSelector
from ..recognition import RecognitionTask
from ..storage import TextTemplateStore
from .status_notifier import StatusNotifier
from .workspace_topic import WorkspaceTopic


class TextTemplateLibrary:
    """
    Text templates saved for reuse by every classifier, kept in the data directory.

    The first run starts from the templates of the classification presets. The plain template ``{}``, which uses the
    phrases as written, is never saved: choosing no template stands for it.
    """

    PLAIN_TEMPLATE: ClassVar[str] = "{}"

    def __init__(self, store: TextTemplateStore, model_selector: ModelSelector, notifier: StatusNotifier) -> None:
        """
        Parameters
        ----------
        store : TextTemplateStore
            File the templates are read from and saved to.
        model_selector : ModelSelector
            Presets whose templates start the library on the first run.
        notifier : StatusNotifier
            Told when the templates change and when they cannot be saved.
        """
        self._store: TextTemplateStore = store
        self._notifier: StatusNotifier = notifier
        stored: tuple[str, ...] | None = store.load()
        self._templates: tuple[str, ...] = self._valid_unique(
            self._preset_templates(model_selector) if stored is None else stored
        )

    @property
    def templates(self) -> tuple[str, ...]:
        """
        Saved templates in the order they were added.

        Returns
        -------
        tuple[str, ...]
            Templates with exactly one ``{}`` each.
        """
        return self._templates

    def replace(self, templates: tuple[str, ...]) -> None:
        """
        Save a new list of templates in place of the current one.

        Parameters
        ----------
        templates : tuple[str, ...]
            Templates in their order; may be empty.

        Raises
        ------
        ValueError
            If a template is repeated, is the plain template or does not have exactly one bare ``{}``.
        """
        if self.PLAIN_TEMPLATE in templates:
            raise ValueError("The plain template '{}' is not saved; choose no template to use phrases as written.")
        if templates:
            TextTemplates(templates)
        self._templates = templates
        self._notifier.save_reporting_failure(lambda: self._store.save(templates), "Could not save the text templates")
        self._notifier.changed(WorkspaceTopic.STATE)

    @classmethod
    def _preset_templates(cls, model_selector: ModelSelector) -> tuple[str, ...]:
        task: RecognitionTask = RecognitionTask.CLASSIFICATION
        if task not in model_selector.tasks:
            return ()
        return tuple(
            template
            for backend in model_selector.backends_of(task)
            for preset in model_selector.presets_of(task, backend)
            for template in model_selector.base_model(task, backend, preset.name).text_templates or ()
        )

    @classmethod
    def _valid_unique(cls, templates: tuple[str, ...]) -> tuple[str, ...]:
        return tuple(
            template
            for template in dict.fromkeys(templates)
            if template != cls.PLAIN_TEMPLATE and cls._is_valid(template)
        )

    @staticmethod
    def _is_valid(template: str) -> bool:
        try:
            TextTemplates((template,))
        except ValueError:
            return False
        return True
