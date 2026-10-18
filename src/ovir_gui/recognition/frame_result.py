from dataclasses import dataclass

from .class_score import ClassScore
from .finding import Finding
from .image_size import ImageSize
from .recognition_task import RecognitionTask
from .recognized_instance import RecognizedInstance


@dataclass(frozen=True, eq=False)
class FrameResult:
    """
    What a model recognized in one image or video frame, independent of the model library.

    A classification holds the score of every class; a detection or segmentation holds its instances ordered by
    descending confidence, segmentation instances with masks. Either way the result lists its ``findings``: the top
    class of a classification, every instance otherwise.

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

    Raises
    ------
    ValueError
        If the content does not fit the task.
    """

    task: RecognitionTask
    image_size: ImageSize
    class_scores: tuple[ClassScore, ...] = ()
    instances: tuple[RecognizedInstance, ...] = ()

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

    @property
    def ranked_scores(self) -> tuple[ClassScore, ...]:
        """
        Class scores from best to worst.

        Returns
        -------
        tuple[ClassScore, ...]
            Scores by descending score, prompt order on ties; empty unless classifying.
        """
        order: list[int] = sorted(range(len(self.class_scores)), key=lambda index: -self.class_scores[index].score)
        return tuple(self.class_scores[index] for index in order)

    @property
    def findings(self) -> tuple[Finding, ...]:
        """
        Reviewable answers of the result.

        Returns
        -------
        tuple[Finding, ...]
            The top class of a classification, or every instance in result order.
        """
        if self.task is RecognitionTask.CLASSIFICATION:
            top: ClassScore = self.ranked_scores[0]
            return (
                Finding(
                    index=0,
                    class_name=top.class_name,
                    query_label=top.query_label,
                    confidence=top.score,
                    box=None,
                    area=None,
                ),
            )
        return tuple(
            Finding(
                index=index,
                class_name=instance.class_name,
                query_label=instance.query_label,
                confidence=instance.confidence,
                box=instance.box,
                area=instance.area,
            )
            for index, instance in enumerate(self.instances)
        )

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
