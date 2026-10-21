from dataclasses import replace

import pytest

from ovir_gui.models import (
    ComputePrecision,
    ModelPreset,
    ModelSelector,
    PresetCatalog,
    RecognitionModel,
    SegmentationMode,
    SegmentationModel,
)
from ovir_gui.prompting import PromptMode, QueryKind
from ovir_gui.recognition import RecognitionTask

CATALOG: PresetCatalog = PresetCatalog.from_packages()


class TestModelPresets:
    """
    Every preset shipped with the model libraries is read into the settings of the library it belongs to.
    """

    def test_every_task_has_presets(self) -> None:
        assert {preset.task for preset in CATALOG.presets} == set(RecognitionTask)

    def test_every_segmentation_mode_has_presets(self) -> None:
        modes: set[SegmentationMode] = {
            SegmentationMode.of_backend(backend) for backend in CATALOG.backends_of(RecognitionTask.SEGMENTATION)
        }
        assert modes == set(SegmentationMode)

    @pytest.mark.parametrize("preset", CATALOG.presets, ids=lambda preset: preset.label)
    def test_preset_is_read(self, preset: ModelPreset) -> None:
        model: RecognitionModel = ModelSelector.read_preset(preset)
        assert model.precision in model.supported_precisions
        assert model.loading_signature()
        assert model.as_selection().backend == preset.backend

    @pytest.mark.parametrize(
        "preset",
        [preset for preset in CATALOG.presets if preset.task is RecognitionTask.SEGMENTATION],
        ids=lambda preset: preset.label,
    )
    def test_segmentation_mode_decides_prompting(self, preset: ModelPreset) -> None:
        model: RecognitionModel = ModelSelector.read_preset(preset)
        mode: SegmentationMode = SegmentationMode.of_backend(preset.backend)
        assert model.prompt_mode is mode.prompt_mode
        assert model.is_sequential is mode.is_sequential
        assert model.profile().is_sequential is mode.is_sequential
        if mode.prompt_mode is PromptMode.AUTOMATIC:
            assert not model.supported_query_kinds

    @pytest.mark.parametrize(
        "backend", ["sam3", f"{SegmentationMode.CONCEPT_TRACKING.backend_prefix}sam3"], ids=lambda backend: backend
    )
    def test_sam3_concepts_take_reference_images(self, backend: str) -> None:
        for preset in CATALOG.presets_of(RecognitionTask.SEGMENTATION, backend):
            model: RecognitionModel = ModelSelector.read_preset(preset)
            assert {QueryKind.TEXT, QueryKind.VISUAL} <= model.supported_query_kinds

    @pytest.mark.parametrize(
        "preset", CATALOG.presets_of(RecognitionTask.SEGMENTATION, "sam3"), ids=lambda preset: preset.label
    )
    @pytest.mark.parametrize("precision", list(ComputePrecision), ids=lambda precision: precision.value)
    def test_segmentation_precision_is_applied(self, preset: ModelPreset, precision: ComputePrecision) -> None:
        model: SegmentationModel = SegmentationModel.from_preset(preset)
        customized: SegmentationModel = model.customized(replace(model.as_selection(), precision=precision), None)
        assert customized.precision is precision
        assert customized.settings.precision.value == precision.value
