from collections.abc import Sequence
from pathlib import Path

import pytest
from open_vocabulary_segmentation import (
    ImageExemplars,
    ImageSize,
    OpenVocabularySegmenter,
    Prompt,
    PromptKind,
    SegmentationResult,
    SegmentationThresholds,
    SegmenterBackend,
    SegmenterSettings,
)
from PIL import Image

from ovir_gui.media import FrameKey, KeyedPicture
from ovir_gui.models import ModelSelector, PresetCatalog, RecognitionModel, SegmentationModel
from ovir_gui.models.segmenter_recognizer import SegmenterRecognizer
from ovir_gui.prompting import (
    ExemplarBox,
    LabeledPrompt,
    PicturePrompts,
    PromptClass,
    PromptSignature,
    QueriedClass,
    QueryKind,
)
from ovir_gui.recognition import RecognitionTask

IMAGE_SIDE = 32


class RecordingSegmenter(OpenVocabularySegmenter):
    """
    SAM 3 stand-in recording the classes and exemplars of every mini-batch, finding nothing.
    """

    BACKENDS = frozenset({SegmenterBackend.SAM3})

    def __init__(self, settings: SegmenterSettings) -> None:
        super().__init__(settings)
        self.calls: list[tuple[tuple[str, ...], list[ImageExemplars | None]]] = []

    @property
    def supported_prompt_kinds(self) -> frozenset[PromptKind]:
        return frozenset({PromptKind.TEXT})

    @property
    def is_exemplar_supported(self) -> bool:
        return True

    def _segment_mini_batch(
        self, images: Sequence[Image.Image], prompt: Prompt, exemplars: Sequence[ImageExemplars | None]
    ) -> list[SegmentationResult]:
        self.calls.append((prompt.class_names, list(exemplars)))
        return [SegmentationResult.empty(prompt, ImageSize.from_image(image)) for image in images]


class TestSegmenterExemplars:
    """
    SAM 3 reads the exemplar boxes of each picture, and a class queried by exemplars alone is segmented only where it
    has a positive box.
    """

    @pytest.fixture
    def model(self) -> SegmentationModel:
        preset = PresetCatalog.from_packages().preset(RecognitionTask.SEGMENTATION, "sam3", "original")
        model: RecognitionModel = ModelSelector.read_preset(preset)
        assert isinstance(model, SegmentationModel)
        assert QueryKind.EXEMPLAR in model.supported_query_kinds
        return model

    def test_pictures_are_grouped_by_their_exemplar_classes(
        self, model: SegmentationModel, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        segmenter: RecordingSegmenter = RecordingSegmenter(
            SegmenterSettings(
                backend=SegmenterBackend.SAM3,
                weights_path="facebook/sam3",
                thresholds=SegmentationThresholds(confidence_threshold=0.5, nms_iou_threshold=None),
            )
        )

        def build(settings: SegmenterSettings) -> OpenVocabularySegmenter:
            return segmenter

        monkeypatch.setattr(SegmenterSettings, "build", build)
        boxed: FrameKey = FrameKey(Path("/media/boxed.png"))
        plain: FrameKey = FrameKey(Path("/media/plain.png"))
        prompt: LabeledPrompt = LabeledPrompt(
            classes=(
                PromptClass(name="car", phrases=("car",), visual_examples=()),
                PromptClass(name="dog", phrases=(), visual_examples=(), is_exemplar_queried=True),
            ),
            class_signature=PromptSignature(
                (
                    QueriedClass(name="car", phrases=frozenset({"car"}), reference_boxes=frozenset()),
                    QueriedClass(name="dog", phrases=frozenset(), reference_boxes=frozenset()),
                )
            ),
            query_kinds=model.supported_query_kinds,
            picture_prompts=PicturePrompts(
                exemplars=(
                    ExemplarBox(boxed, "dog", 2.0, 2.0, 12.0, 12.0),
                    ExemplarBox(boxed, "car", 14.0, 14.0, 30.0, 30.0, is_positive=False),
                )
            ),
        )
        image: Image.Image = Image.new("RGB", (IMAGE_SIDE, IMAGE_SIDE))
        recognizer: SegmenterRecognizer = SegmenterRecognizer(model)
        results = recognizer.recognize([KeyedPicture(boxed, image), KeyedPicture(plain, image)], prompt)
        assert len(results) == 2
        assert [class_names for class_names, _ in segmenter.calls] == [("car", "dog"), ("car",)]
        boxed_exemplars: ImageExemplars | None = segmenter.calls[0][1][0]
        assert boxed_exemplars is not None
        dog = boxed_exemplars.of_class("dog")
        car = boxed_exemplars.of_class("car")
        assert dog is not None and dog.is_text_ignored and dog.negative_boxes is None
        assert car is not None and not car.is_text_ignored and car.positive_boxes is None
        assert segmenter.calls[1][1] == [None]
