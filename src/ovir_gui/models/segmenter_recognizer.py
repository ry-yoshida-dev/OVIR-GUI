from collections.abc import Sequence

import numpy as np
from geometry import Box2DFormat, Boxes2D
from open_vocabulary_segmentation import (
    BoxExemplars,
    DetectorSettings,
    ImageExemplars,
    OpenVocabularySegmenter,
    Prompt,
    SegmentationResult,
)
from open_vocabulary_segmentation.backends.box_prompted import BoxPromptedSegmenter

from ..media import KeyedPicture
from ..prompting import ExemplarBox, FramePrompt, LabeledPrompt, PromptClass
from ..recognition import FrameResult, ImageSize, InstanceMask, RecognitionTask, RecognizedInstance
from .detector_prompt_builder import DetectorPromptBuilder
from .recognizer import Recognizer
from .segmentation_model import SegmentationModel


class SegmenterRecognizer(Recognizer[SegmentationModel]):
    """
    Loaded ``open_vocabulary_segmentation`` segmenter; masks are kept compact as ``InstanceMask``s.

    For SAM 3, the exemplar boxes drawn on each picture join the phrases of their class there. A class queried by
    exemplar boxes alone is segmented only on the pictures holding a positive box of it, so the pictures of a
    mini-batch are segmented in groups sharing the same classes.
    """

    def __init__(self, model: SegmentationModel) -> None:
        """
        Load the segmenter and, for SAM and SAM 2, its box detector.

        Parameters
        ----------
        model : SegmentationModel
            Settings to load.
        """
        super().__init__(model, SegmentationModel)
        self._segmenter: OpenVocabularySegmenter = model.settings.build()
        self._prompts: DetectorPromptBuilder = DetectorPromptBuilder()

    def _apply_model(self) -> None:
        self._segmenter.settings = self._model.settings
        box_detector_settings: DetectorSettings | None = self._model.settings.box_detector
        if isinstance(self._segmenter, BoxPromptedSegmenter) and box_detector_settings is not None:
            self._segmenter.box_detector.settings = box_detector_settings

    def recognize(self, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt) -> list[FrameResult]:
        groups: dict[tuple[str, ...], list[int]] = {}
        for index, picture in enumerate(pictures):
            groups.setdefault(self._class_names_on(picture, prompt), []).append(index)
        results: dict[int, FrameResult] = {}
        for class_names, indices in groups.items():
            group: list[KeyedPicture] = [pictures[index] for index in indices]
            results.update(zip(indices, self._segment_group(group, prompt.restricted_to(class_names)), strict=True))
        return [results[index] for index in range(len(pictures))]

    def _class_names_on(self, picture: KeyedPicture, prompt: LabeledPrompt) -> tuple[str, ...]:
        frame_prompt: FramePrompt = prompt.frame_prompt_of(picture.frame_key)
        return tuple(
            prompt_class.name
            for prompt_class in prompt.classes
            if not prompt_class.is_exemplar_only
            or (self._segmenter.is_exemplar_supported and frame_prompt.has_positive_exemplar(prompt_class.name))
        )

    def _segment_group(self, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt) -> list[FrameResult]:
        if not prompt.classes:
            return [
                FrameResult(
                    task=RecognitionTask.SEGMENTATION,
                    image_size=ImageSize(width=picture.image.width, height=picture.image.height),
                )
                for picture in pictures
            ]
        library_prompt: Prompt = self._prompts.build(prompt)
        exemplars: list[ImageExemplars | None] | None = (
            [self._exemplars_of(prompt, prompt.frame_prompt_of(picture.frame_key)) for picture in pictures]
            if self._segmenter.is_exemplar_supported and prompt.has_exemplars
            else None
        )
        results: list[SegmentationResult] = self._segmenter.segment_images(
            [picture.image for picture in pictures], library_prompt, exemplars
        )
        return [self._convert(result, prompt.query_labels) for result in results]

    @classmethod
    def _exemplars_of(cls, prompt: LabeledPrompt, frame_prompt: FramePrompt) -> ImageExemplars | None:
        exemplars_by_class: dict[str, BoxExemplars] = {}
        for prompt_class in prompt.classes:
            class_exemplars: BoxExemplars | None = cls._class_exemplars(prompt_class, frame_prompt)
            if class_exemplars is not None:
                exemplars_by_class[prompt_class.name] = class_exemplars
        return ImageExemplars(exemplars_by_class) if exemplars_by_class else None

    @classmethod
    def _class_exemplars(cls, prompt_class: PromptClass, frame_prompt: FramePrompt) -> BoxExemplars | None:
        boxes: tuple[ExemplarBox, ...] = frame_prompt.exemplars_of(prompt_class.name)
        positive_boxes: Boxes2D | None = cls._boxes_of([box for box in boxes if box.is_positive])
        negative_boxes: Boxes2D | None = cls._boxes_of([box for box in boxes if not box.is_positive])
        if positive_boxes is None and negative_boxes is None:
            return None
        if prompt_class.is_exemplar_only and positive_boxes is None:
            return None
        return BoxExemplars(
            positive_boxes=positive_boxes,
            negative_boxes=negative_boxes,
            is_text_ignored=prompt_class.is_exemplar_only,
        )

    @staticmethod
    def _boxes_of(boxes: Sequence[ExemplarBox]) -> Boxes2D | None:
        if not boxes:
            return None
        return Boxes2D.register(
            value=np.array([box.xyxy for box in boxes], dtype=np.float64).reshape(-1, 4), box2d_format=Box2DFormat.XYXY
        )

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
