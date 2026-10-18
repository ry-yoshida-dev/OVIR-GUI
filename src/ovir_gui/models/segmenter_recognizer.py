from collections.abc import Sequence

from open_vocabulary_segmentation import DetectorSettings, OpenVocabularySegmenter, Prompt, SegmentationResult
from open_vocabulary_segmentation.backends.box_prompted import BoxPromptedSegmenter
from PIL import Image

from ..prompting import LabeledPrompt
from ..recognition import FrameResult, ImageSize, InstanceMask, RecognitionTask, RecognizedInstance
from .detector_prompt_builder import DetectorPromptBuilder
from .recognition_model import RecognitionModel
from .recognizer import Recognizer
from .segmentation_model import SegmentationModel


class SegmenterRecognizer(Recognizer):
    """
    Loaded ``open_vocabulary_segmentation`` segmenter; masks are kept compact as ``InstanceMask``s.
    """

    def __init__(self, model: SegmentationModel) -> None:
        """
        Load the segmenter and, for SAM and SAM 2, its box detector.

        Parameters
        ----------
        model : SegmentationModel
            Settings to load.
        """
        self._model: SegmentationModel = model
        self._segmenter: OpenVocabularySegmenter = model.settings.build()
        self._prompts: DetectorPromptBuilder = DetectorPromptBuilder()

    @property
    def model(self) -> RecognitionModel:
        return self._model

    def adopt(self, model: RecognitionModel) -> None:
        if not isinstance(model, SegmentationModel):
            raise TypeError(f"a segmenter cannot run {model.task.value} settings.")
        self.require_reusable(model)
        self._model = model
        self._segmenter.settings = model.settings
        box_detector_settings: DetectorSettings | None = model.settings.box_detector
        if isinstance(self._segmenter, BoxPromptedSegmenter) and box_detector_settings is not None:
            self._segmenter.box_detector.settings = box_detector_settings

    def recognize(self, images: Sequence[Image.Image], prompt: LabeledPrompt) -> list[FrameResult]:
        library_prompt: Prompt = self._prompts.build(prompt)
        query_labels: tuple[str, ...] = prompt.query_labels
        results: list[SegmentationResult] = self._segmenter.segment_images(list(images), library_prompt)
        return [self._convert(result, query_labels) for result in results]

    @staticmethod
    def _convert(result: SegmentationResult, query_labels: tuple[str, ...]) -> FrameResult:
        class_ids: list[int] = [int(class_id) for class_id in result.class_ids.tolist()]
        query_ids: list[int] = [int(query_id) for query_id in result.query_ids.tolist()]
        confidences: list[float] = [float(confidence) for confidence in result.confidences.tolist()]
        instances: list[RecognizedInstance] = []
        for index, confidence in enumerate(confidences):
            mask: InstanceMask | None = InstanceMask.from_dense(result.masks[index])
            if mask is None:
                continue
            instances.append(
                RecognizedInstance(
                    class_name=result.class_names[class_ids[index]],
                    query_label=query_labels[query_ids[index]],
                    confidence=confidence,
                    box=mask.box,
                    mask=mask,
                )
            )
        return FrameResult(
            task=RecognitionTask.SEGMENTATION,
            image_size=ImageSize(width=result.image_size.width, height=result.image_size.height),
            instances=tuple(instances),
        )
