from dataclasses import dataclass

from .class_score import ClassScore
from .finding import Finding
from .image_size import ImageSize
from .label_mode import LabelMode
from .recognition_task import RecognitionTask
from .recognized_instance import RecognizedInstance


@dataclass(frozen=True, eq=False)
class FrameResult:
    """
    What a model recognized in one image or video frame, independent of the model library.

    A classification holds the score of every class; a detection or segmentation holds its instances ordered by
    descending confidence, segmentation instances with masks. Either way the result lists its findings: the best
    class or every class of a classification, depending on the label mode, and every instance otherwise. A finding
    is indexed by the position of its class score or instance, so the index stays the same in either label mode.

    Attributes
    ----------
    task : RecognitionTask
        Task of the model.
    image_size : ImageSize
        Size of the recognized pixels.
    class_scores : tuple[ClassScore, ...]
        Score of every class in prompt order; empty unless classifying.
    instances : tuple[RecognizedInstance, ...]
        Found instances; empty when classifying.
    native_label_mode : LabelMode
        Label mode the scores are made for: single-label for a classifier whose softmax shares the score among the
        classes, multi-label for one scoring every class on its own (sigmoid) and for detection and segmentation.

    Raises
    ------
    ValueError
        If the content does not fit the task.
    """

    task: RecognitionTask
    image_size: ImageSize
    class_scores: tuple[ClassScore, ...] = ()
    instances: tuple[RecognizedInstance, ...] = ()
    native_label_mode: LabelMode = LabelMode.MULTI_LABEL

    def __post_init__(self) -> None:
        match self.task:
            case RecognitionTask.CLASSIFICATION:
                if self.instances:
                    raise ValueError("a classification holds no instances.")
                if not self.class_scores:
                    raise ValueError("a classification needs the score of at least one class.")
            case RecognitionTask.DETECTION:
                if self.class_scores:
                    raise ValueError("a detection holds no class scores.")
            case RecognitionTask.SEGMENTATION:
                if self.class_scores:
                    raise ValueError("a segmentation holds no class scores.")
                if any(instance.mask is None for instance in self.instances):
                    raise ValueError("every segmented instance needs a mask.")
        if self.task is not RecognitionTask.CLASSIFICATION and self.native_label_mode is LabelMode.SINGLE_LABEL:
            raise ValueError(f"a {self.task.value} reports any number of classes.")

    @property
    def ranked_scores(self) -> tuple[ClassScore, ...]:
        """
        Class scores from best to worst.

        Returns
        -------
        tuple[ClassScore, ...]
            Scores by descending score, prompt order on ties; empty unless classifying.
        """
        return tuple(self.class_scores[index] for index in self._ranked_class_indices())

    @property
    def candidate_count(self) -> int:
        """
        Findings the result can list in any label mode.

        Returns
        -------
        int
            Count of the class scores of a classification, or of the instances.
        """
        return len(self.class_scores) if self.class_scores else len(self.instances)

    def finding_of(self, index: int) -> Finding:
        """
        One finding, whether or not the label mode lists it.

        Parameters
        ----------
        index : int
            Position of the class score or the instance.

        Returns
        -------
        Finding
            Class or instance at ``index``.

        Raises
        ------
        IndexError
            If ``index`` is outside ``[0, candidate_count)``.
        """
        if not 0 <= index < self.candidate_count:
            raise IndexError(f"finding index must be in [0, {self.candidate_count}). got {index}")
        if self.task is RecognitionTask.CLASSIFICATION:
            score: ClassScore = self.class_scores[index]
            return Finding(
                index=index,
                class_name=score.class_name,
                query_label=score.query_label,
                confidence=score.score,
                box=None,
                area=None,
                similarity=score.similarity,
            )
        instance: RecognizedInstance = self.instances[index]
        return Finding(
            index=index,
            class_name=instance.class_name,
            query_label=instance.query_label,
            confidence=instance.confidence,
            box=instance.box,
            area=instance.area,
            similarity=None,
        )

    def findings_of(self, label_mode: LabelMode) -> tuple[Finding, ...]:
        """
        Reviewable answers of the result.

        Parameters
        ----------
        label_mode : LabelMode
            How many classes a classification lists; instances are all listed whatever the mode.

        Returns
        -------
        tuple[Finding, ...]
            The best class or every class from best to worst of a classification, or every instance in result order.
        """
        if self.task is not RecognitionTask.CLASSIFICATION:
            return tuple(self.finding_of(index) for index in range(len(self.instances)))
        ranked: tuple[int, ...] = self._ranked_class_indices()
        match label_mode:
            case LabelMode.SINGLE_LABEL:
                return (self.finding_of(ranked[0]),)
            case LabelMode.MULTI_LABEL:
                return tuple(self.finding_of(index) for index in ranked)

    @property
    def class_names(self) -> tuple[str, ...]:
        """
        Classes the result reports.

        Returns
        -------
        tuple[str, ...]
            Classes of the scores or the instances, each once in order of appearance.
        """
        names: list[str] = [score.class_name for score in self.class_scores]
        names.extend(instance.class_name for instance in self.instances)
        return tuple(dict.fromkeys(names))

    def _ranked_class_indices(self) -> tuple[int, ...]:
        return tuple(sorted(range(len(self.class_scores)), key=lambda index: -self.class_scores[index].score))
