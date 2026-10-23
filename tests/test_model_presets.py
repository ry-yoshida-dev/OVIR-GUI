from dataclasses import replace

import pytest

from ovir_gui.models import (
    ComputePrecision,
    DeviceAvailability,
    ModelPreset,
    ModelSelection,
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
        selector: ModelSelector = ModelSelector(CATALOG, DeviceAvailability.detect())
        customized: SegmentationModel = model.customized(
            replace(model.as_selection(), precision=precision), selector.box_detector_model
        )
        assert customized.precision is precision
        assert customized.settings.precision.value == precision.value

    @pytest.mark.parametrize("preset", CATALOG.presets, ids=lambda preset: preset.label)
    def test_batch_size_is_applied_without_changing_profile(self, preset: ModelPreset) -> None:
        selector: ModelSelector = ModelSelector(CATALOG, DeviceAvailability.detect())
        base: RecognitionModel = ModelSelector.read_preset(preset)
        selection: ModelSelection = base.as_selection()
        if selection.batch_size is None:
            assert base.batch_size == 1
            return
        customized: RecognitionModel = selector.model_of(replace(selection, batch_size=1))
        assert customized.batch_size == 1
        assert customized.as_selection().batch_size == 1
        assert customized.profile() == selector.model_of(selection).profile()

    @pytest.mark.parametrize("batch_size", [0, 3, 6])
    def test_batch_size_must_be_power_of_two(self, batch_size: int) -> None:
        selection: ModelSelection = ModelSelector.read_preset(CATALOG.presets[0]).as_selection()
        with pytest.raises(ValueError, match="power of two"):
            _ = replace(selection, batch_size=batch_size)

    @pytest.mark.parametrize("preset", CATALOG.presets, ids=lambda preset: preset.label)
    def test_missing_batch_size_is_filled_with_preset_value(self, preset: ModelPreset) -> None:
        selector: ModelSelector = ModelSelector(CATALOG, DeviceAvailability.detect())
        selection: ModelSelection = ModelSelector.read_preset(preset).as_selection()
        validated: ModelSelection = selector.validated(replace(selection, batch_size=None))
        assert validated.batch_size == selection.batch_size
