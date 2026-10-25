from ..recognition import RecognitionTask
from ..review import ClassThresholds, DuplicateSuppression, LabelModeChoice, ReviewFilter
from ..storage import ClassThresholdStore, DuplicateSuppressionStore, LabelModeStore
from .recognition_settings import RecognitionSettings
from .status_notifier import StatusNotifier
from .workspace_topic import WorkspaceTopic


class ReviewSettings:
    """
    Which stored findings pass the review for each task: the label mode of classifications, the minimum confidence of
    the classes and the suppression of overlapping boxes, remembered in the data directory whenever they change.
    """

    def __init__(
        self,
        threshold_store: ClassThresholdStore,
        suppression_store: DuplicateSuppressionStore,
        label_mode_store: LabelModeStore,
        settings: RecognitionSettings,
        notifier: StatusNotifier,
    ) -> None:
        """
        Parameters
        ----------
        threshold_store : ClassThresholdStore
            File remembering the minimums of every task.
        suppression_store : DuplicateSuppressionStore
            File remembering the suppression of every task.
        label_mode_store : LabelModeStore
            File remembering the label mode of classifications.
        settings : RecognitionSettings
            Settings naming the current task.
        notifier : StatusNotifier
            Views told about changes and failed saves.
        """
        self._threshold_store: ClassThresholdStore = threshold_store
        self._suppression_store: DuplicateSuppressionStore = suppression_store
        self._label_mode_store: LabelModeStore = label_mode_store
        self._settings: RecognitionSettings = settings
        self._notifier: StatusNotifier = notifier
        self._thresholds: dict[RecognitionTask, ClassThresholds] = threshold_store.load()
        self._suppressions: dict[RecognitionTask, DuplicateSuppression] = suppression_store.load()
        self._label_mode: LabelModeChoice = label_mode_store.load()

    @property
    def class_thresholds(self) -> ClassThresholds:
        """
        Minimum confidence of each class for the current task.

        Returns
        -------
        ClassThresholds
            Default and per-class minimums.
        """
        return self._thresholds.get(self._settings.task, ClassThresholds())

    @property
    def duplicate_suppression(self) -> DuplicateSuppression:
        """
        Review suppression of overlapping boxes for the current task.

        Returns
        -------
        DuplicateSuppression
            Whether it runs and its overlaps.
        """
        return self._suppressions.get(self._settings.task, DuplicateSuppression())

    @property
    def label_mode(self) -> LabelModeChoice:
        """
        Label mode chosen for classifications.

        Returns
        -------
        LabelModeChoice
            Chosen mode, automatic by default.
        """
        return self._label_mode

    @property
    def review_filter(self) -> ReviewFilter:
        """
        Which stored findings of the current task pass the review.

        Returns
        -------
        ReviewFilter
            Minimums and suppression of the current task.
        """
        return self.filter_of(self._settings.task)

    def filter_of(self, task: RecognitionTask) -> ReviewFilter:
        """
        Which stored findings of a task pass the review.

        Parameters
        ----------
        task : RecognitionTask
            Task of the findings.

        Returns
        -------
        ReviewFilter
            Label mode, minimums and suppression of the task.
        """
        return ReviewFilter(
            self._thresholds.get(task, ClassThresholds()),
            self._suppressions.get(task, DuplicateSuppression()),
            self._label_mode if task is RecognitionTask.CLASSIFICATION else LabelModeChoice.AUTOMATIC,
        )

    def set_class_thresholds(self, class_thresholds: ClassThresholds) -> None:
        """
        Change the minimum confidence of the classes for the current task and remember it.

        Parameters
        ----------
        class_thresholds : ClassThresholds
            Default and per-class minimums.
        """
        self._thresholds[self._settings.task] = class_thresholds
        self._notifier.save_reporting_failure(
            lambda: self._threshold_store.save(self._thresholds), "Could not save the class minimums"
        )
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def set_duplicate_suppression(self, suppression: DuplicateSuppression) -> None:
        """
        Change the review suppression of overlapping boxes for the current task and remember it.

        Parameters
        ----------
        suppression : DuplicateSuppression
            Whether it runs and its overlaps.
        """
        self._suppressions[self._settings.task] = suppression
        self._notifier.save_reporting_failure(
            lambda: self._suppression_store.save(self._suppressions), "Could not save the duplicate suppression"
        )
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)

    def set_label_mode(self, label_mode: LabelModeChoice) -> None:
        """
        Change the label mode of classifications and remember it.

        Parameters
        ----------
        label_mode : LabelModeChoice
            Automatic, single- or multi-label.
        """
        self._label_mode = label_mode
        self._notifier.save_reporting_failure(
            lambda: self._label_mode_store.save(label_mode), "Could not save the label mode"
        )
        self._notifier.changed(WorkspaceTopic.STATE, WorkspaceTopic.RESULTS)
