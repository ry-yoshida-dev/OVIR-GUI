from collections.abc import Sequence

from open_vocabulary_segmentation import ObjectPrompt, ObjectTracker, TrackedFrame, TrackingSession

from ..media import KeyedPicture
from ..prompting import LabeledPrompt, ObjectMark
from ..recognition import FrameResult, ImageSize, InstanceMask, RecognitionTask, RecognizedInstance
from .object_prompt_builder import ObjectPromptBuilder
from .object_tracking_model import ObjectTrackingModel
from .recognition_model import RecognitionModel
from .recognizer import Recognizer
from .stream_position import StreamPosition


class ObjectTrackingRecognizer(Recognizer):
    """
    Loaded video object tracker following the marked objects through the frames it is handed in order.

    A streaming session starts at the first marked frame of a video, so earlier frames are answered empty without
    running the model, and takes the marks of every later frame as corrections. Each object is reported under the
    class of its marks.
    """

    def __init__(self, model: ObjectTrackingModel) -> None:
        """
        Load the tracker.

        Parameters
        ----------
        model : ObjectTrackingModel
            Settings to load.
        """
        self._model: ObjectTrackingModel = model
        self._tracker: ObjectTracker = model.settings.build()
        self._prompts: ObjectPromptBuilder = ObjectPromptBuilder(ObjectTrackingModel.SUPPORTED_ELEMENTS)
        self._stream: TrackingSession | None = None
        self._position: StreamPosition = StreamPosition()

    @property
    def model(self) -> RecognitionModel:
        return self._model

    def adopt(self, model: RecognitionModel) -> None:
        if not isinstance(model, ObjectTrackingModel):
            raise TypeError(f"an object tracker cannot run {model.backend} settings.")
        self.require_reusable(model)
        self._model = model

    def recognize(self, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt) -> list[FrameResult]:
        return [self._track(picture, prompt) for picture in pictures]

    def _track(self, picture: KeyedPicture, prompt: LabeledPrompt) -> FrameResult:
        if not self._position.is_continued_by(picture.frame_key, prompt):
            self._stream = None
        self._position.advance(picture.frame_key, prompt)
        image_size: ImageSize = ImageSize(width=picture.image.width, height=picture.image.height)
        frame_prompts: dict[int, ObjectPrompt] = {}
        for mark in prompt.frame_prompt_of(picture.frame_key).marks:
            object_prompt: ObjectPrompt | None = self._prompts.build(mark)
            if object_prompt is not None:
                frame_prompts[mark.object_id] = object_prompt
        if self._stream is None:
            if not frame_prompts:
                return FrameResult(task=RecognitionTask.SEGMENTATION, image_size=image_size)
            self._stream = self._tracker.start_stream()
        tracked: TrackedFrame = self._stream.track_next(picture.image, frame_prompts or None)
        class_names: dict[int, str] = {mark.object_id: mark.class_name for mark in self._media_marks(picture, prompt)}
        visible: TrackedFrame = tracked.visible_objects(self._model.minimum_presence)
        instances: list[RecognizedInstance] = []
        for index, object_id in enumerate(int(value) for value in visible.object_ids.tolist()):
            mask: InstanceMask | None = InstanceMask.from_dense(visible.masks[index])
            if mask is None or object_id not in class_names:
                continue
            instances.append(
                RecognizedInstance(
                    class_name=class_names[object_id],
                    query_label=f"object {object_id}",
                    confidence=float(visible.presence_scores[index]),
                    box=mask.box,
                    mask=mask,
                )
            )
        instances.sort(key=lambda instance: -instance.confidence)
        return FrameResult(task=RecognitionTask.SEGMENTATION, image_size=image_size, instances=tuple(instances))

    @staticmethod
    def _media_marks(picture: KeyedPicture, prompt: LabeledPrompt) -> tuple[ObjectMark, ...]:
        return prompt.picture_prompts.of_media(picture.frame_key.path).marks
