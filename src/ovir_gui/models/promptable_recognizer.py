from collections import OrderedDict
from collections.abc import Sequence
from typing import ClassVar

from open_vocabulary_segmentation import (
    EncodedImage,
    ObjectPrompt,
    ObjectSegmentation,
    ObjectSegmentationResult,
    PromptableSegmenter,
)

from ..media import FrameKey, KeyedPicture
from ..prompting import LabeledPrompt, ObjectMark, ReferenceImage
from ..recognition import FrameResult, ImageSize, InstanceMask, RecognitionTask, RecognizedInstance
from .object_prompt_builder import ObjectPromptBuilder
from .promptable_segmentation_model import PromptableSegmentationModel
from .recognition_model import RecognitionModel
from .recognizer import Recognizer


class PromptableRecognizer(Recognizer):
    """
    Loaded promptable segmenter segmenting the objects marked on each picture.

    The encodings of the last pictures are kept, so marking one more point on the shown picture only runs the light
    mask decoder. An encoding is reused only while the picture shows the same pixels.
    """

    ENCODING_CACHE_SIZE: ClassVar[int] = 4

    def __init__(self, model: PromptableSegmentationModel) -> None:
        """
        Load the promptable segmenter.

        Parameters
        ----------
        model : PromptableSegmentationModel
            Settings to load.
        """
        self._model: PromptableSegmentationModel = model
        self._segmenter: PromptableSegmenter = model.settings.build()
        self._prompts: ObjectPromptBuilder = ObjectPromptBuilder(model.supported_elements)
        self._encodings: OrderedDict[FrameKey, tuple[str, EncodedImage]] = OrderedDict()

    @property
    def model(self) -> RecognitionModel:
        return self._model

    def adopt(self, model: RecognitionModel) -> None:
        if not isinstance(model, PromptableSegmentationModel):
            raise TypeError(f"a promptable segmenter cannot run {model.backend} settings.")
        self.require_reusable(model)
        self._model = model

    def recognize(self, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt) -> list[FrameResult]:
        return [self._segment(picture, prompt) for picture in pictures]

    def _segment(self, picture: KeyedPicture, prompt: LabeledPrompt) -> FrameResult:
        image_size: ImageSize = ImageSize(width=picture.image.width, height=picture.image.height)
        marks: list[ObjectMark] = []
        object_prompts: list[ObjectPrompt] = []
        for mark in prompt.frame_prompt_of(picture.frame_key).marks:
            object_prompt: ObjectPrompt | None = self._prompts.build(mark)
            if object_prompt is not None:
                marks.append(mark)
                object_prompts.append(object_prompt)
        if not object_prompts:
            return FrameResult(task=RecognitionTask.SEGMENTATION, image_size=image_size)
        result: ObjectSegmentationResult = self._segmenter.segment(self._encoding_of(picture), object_prompts)
        instances: list[RecognizedInstance] = []
        for segmentation in result.best_per_prompt():
            instance: RecognizedInstance | None = self._instance_of(segmentation, marks[segmentation.prompt_index])
            if instance is not None:
                instances.append(instance)
        instances.sort(key=lambda instance: -instance.confidence)
        return FrameResult(task=RecognitionTask.SEGMENTATION, image_size=image_size, instances=tuple(instances))

    def _instance_of(self, segmentation: ObjectSegmentation, mark: ObjectMark) -> RecognizedInstance | None:
        mask: InstanceMask | None = InstanceMask.from_dense(segmentation.mask)
        if mask is None:
            return None
        return RecognizedInstance(
            class_name=mark.class_name,
            query_label=mark.label,
            confidence=float(segmentation.score),
            box=mask.box,
            mask=mask,
        )

    def _encoding_of(self, picture: KeyedPicture) -> EncodedImage:
        digest: str = ReferenceImage.digest_of(picture.image)
        cached: tuple[str, EncodedImage] | None = self._encodings.get(picture.frame_key)
        if cached is not None and cached[0] == digest:
            self._encodings.move_to_end(picture.frame_key)
            return cached[1]
        encoding: EncodedImage = self._segmenter.encode(picture.image)
        self._encodings[picture.frame_key] = (digest, encoding)
        self._encodings.move_to_end(picture.frame_key)
        while len(self._encodings) > self.ENCODING_CACHE_SIZE:
            self._encodings.popitem(last=False)
        return encoding
