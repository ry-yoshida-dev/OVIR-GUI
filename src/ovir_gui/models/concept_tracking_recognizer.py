from collections.abc import Sequence

from open_vocabulary_segmentation import ConceptFrame, ConceptTracker, ConceptTrackingSession, Prompt

from ..media import KeyedPicture
from ..prompting import LabeledPrompt
from ..recognition import FrameResult, ImageSize, InstanceMask, RecognitionTask, RecognizedInstance
from .concept_tracking_model import ConceptTrackingModel
from .detector_prompt_builder import DetectorPromptBuilder
from .recognition_model import RecognitionModel
from .recognizer import Recognizer
from .stream_position import StreamPosition


class ConceptTrackingRecognizer(Recognizer):
    """
    Loaded SAM 3 concept tracker detecting and following the instances of the phrases and reference images through
    the frames it is handed in order; the query label of each instance names its track.
    """

    def __init__(self, model: ConceptTrackingModel) -> None:
        """
        Load the tracker.

        Parameters
        ----------
        model : ConceptTrackingModel
            Settings to load.
        """
        self._model: ConceptTrackingModel = model
        self._tracker: ConceptTracker = model.settings.build()
        self._prompts: DetectorPromptBuilder = DetectorPromptBuilder()
        self._stream: ConceptTrackingSession | None = None
        self._position: StreamPosition = StreamPosition()

    @property
    def model(self) -> RecognitionModel:
        return self._model

    def adopt(self, model: RecognitionModel) -> None:
        if not isinstance(model, ConceptTrackingModel):
            raise TypeError(f"a concept tracker cannot run {model.backend} settings.")
        self.require_reusable(model)
        self._model = model
        self._tracker.settings = model.settings
        self._stream = None
        self._position.reset()

    def recognize(self, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt) -> list[FrameResult]:
        return [self._track(picture, prompt) for picture in pictures]

    def _track(self, picture: KeyedPicture, prompt: LabeledPrompt) -> FrameResult:
        image_size: ImageSize = ImageSize(width=picture.image.width, height=picture.image.height)
        if not prompt.classes:
            return FrameResult(task=RecognitionTask.SEGMENTATION, image_size=image_size)
        if self._stream is None or not self._position.is_continued_by(picture.frame_key, prompt):
            library_prompt: Prompt = self._prompts.build(prompt)
            self._stream = self._tracker.start_stream(library_prompt)
        self._position.advance(picture.frame_key, prompt)
        frame: ConceptFrame = self._stream.track_next(picture.image)
        query_labels: tuple[str, ...] = prompt.query_labels
        class_ids: list[int] = [int(class_id) for class_id in frame.instances.class_ids.tolist()]
        query_ids: list[int] = [int(query_id) for query_id in frame.instances.query_ids.tolist()]
        confidences: list[float] = [float(confidence) for confidence in frame.instances.confidences.tolist()]
        track_ids: list[int] = [int(track_id) for track_id in frame.track_ids.tolist()]
        instances: list[RecognizedInstance] = []
        for index, confidence in enumerate(confidences):
            mask: InstanceMask | None = InstanceMask.from_dense(frame.instances.masks[index])
            if mask is None:
                continue
            instances.append(
                RecognizedInstance(
                    class_name=frame.instances.class_names[class_ids[index]],
                    query_label=f"{query_labels[query_ids[index]]} · track {track_ids[index]}",
                    confidence=confidence,
                    box=mask.box,
                    mask=mask,
                )
            )
        instances.sort(key=lambda instance: -instance.confidence)
        return FrameResult(task=RecognitionTask.SEGMENTATION, image_size=image_size, instances=tuple(instances))
