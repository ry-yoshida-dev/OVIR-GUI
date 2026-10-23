from ..models import RecognitionModel
from ..prompting import LabeledPrompt, PromptClass, PromptMode, QueryKind, ReferenceBoard
from ..vocabulary import ClassDefinition
from .class_workbench import ClassWorkbench
from .prompt_preparation import PromptPreparation
from .working_state import WorkingState


class PromptAssembler:
    """
    Builds the prompt of a model from the classes, their reference images and the drawings on the open media.

    A class queried only by reference images is left out for a model that cannot take them once the user approved
    skipping it; the approval holds until the set of such classes changes. Background recognition never asks for
    approval: it runs only with classes the user already approved leaving out.
    """

    def __init__(self, working: WorkingState, workbench: ClassWorkbench) -> None:
        """
        Parameters
        ----------
        working : WorkingState
            Open media whose drawings are read.
        workbench : ClassWorkbench
            Classes with their phrases, reference images and drawings.
        """
        self._working: WorkingState = working
        self._workbench: ClassWorkbench = workbench
        self._approved_skipped_classes: frozenset[str] = frozenset()

    def prepare(self, model: RecognitionModel, is_skipping_approved: bool) -> PromptPreparation:
        """
        Prompt of a model, or why none can be built.

        Parameters
        ----------
        model : RecognitionModel
            Model to recognize with.
        is_skipping_approved : bool
            Whether the user approved leaving out the classes the model cannot query; remembered when given.

        Returns
        -------
        PromptPreparation
            The prompt, the classes waiting for approval, or the issue preventing a prompt.
        """
        match model.prompt_mode:
            case PromptMode.MARKS | PromptMode.AUTOMATIC:
                return PromptPreparation(prompt=self._labeled_prompt(model, ()))
            case PromptMode.CLASSES:
                pass
        supported_kinds: frozenset[QueryKind] = model.supported_query_kinds
        exemplar_names: frozenset[str] = self._exemplar_class_names()
        definitions: tuple[ClassDefinition, ...] = self._workbench.classes
        board: ReferenceBoard = self._workbench.reference_board
        skipped_names: tuple[str, ...] = board.reference_only_classes(definitions, supported_kinds, exemplar_names)
        if skipped_names and len(skipped_names) < len(definitions):
            if frozenset(skipped_names) != self._approved_skipped_classes:
                if not is_skipping_approved:
                    return PromptPreparation(prompt=None, unapproved_class_names=skipped_names)
                self._approved_skipped_classes = frozenset(skipped_names)
            definitions = tuple(definition for definition in definitions if definition.name not in skipped_names)
        issue: str | None = board.prompt_issue(definitions, supported_kinds, exemplar_names)
        if issue is not None:
            return PromptPreparation(prompt=None, issue=issue)
        return PromptPreparation(
            prompt=self._labeled_prompt(model, board.build_classes(definitions, supported_kinds, exemplar_names))
        )

    def background_prompt(self, model: RecognitionModel) -> LabeledPrompt | None:
        """
        Prompt of a model for background recognition, without asking for approval.

        Parameters
        ----------
        model : RecognitionModel
            Model to recognize with.

        Returns
        -------
        LabeledPrompt | None
            ``None`` when classes wait for approval or no prompt can be built.
        """
        return self.prepare(model, False).prompt

    def _labeled_prompt(self, model: RecognitionModel, classes: tuple[PromptClass, ...]) -> LabeledPrompt:
        return LabeledPrompt(
            classes=classes,
            class_signature=self._workbench.reference_board.signature_of(self._workbench.classes),
            query_kinds=model.supported_query_kinds,
            picture_prompts=self._workbench.picture_board.prompts.restricted_to(self._working.media),
            is_sequential=model.is_sequential,
        )

    def _exemplar_class_names(self) -> frozenset[str]:
        return frozenset(box.class_name for box in self._workbench.picture_board.prompts.exemplars if box.is_positive)
