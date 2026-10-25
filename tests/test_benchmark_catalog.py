from ovir_gui.models import (
    BenchmarkCatalog,
    DeviceAvailability,
    LvisSplit,
    ModelBenchmark,
    ModelSelector,
    PresetCatalog,
    RecognitionModel,
)
from ovir_gui.recognition import RecognitionTask


class TestBenchmarkCatalog:
    """
    The bundled benchmarks are read with their markers and match the weights of shipped detection presets.
    """

    def test_bundled_benchmark_keeps_split_and_zero_shot(self) -> None:
        catalog: BenchmarkCatalog = BenchmarkCatalog.bundled()
        assert catalog.benchmark_of("google/owlv2-base-patch16-ensemble") == ModelBenchmark(
            lvis_ap=43.9, lvis_split=LvisSplit.VALIDATION, is_lvis_zero_shot=False, gflops=638.2
        )

    def test_unreported_accuracy_is_none(self) -> None:
        benchmark: ModelBenchmark | None = BenchmarkCatalog.bundled().benchmark_of("IDEA-Research/grounding-dino-base")
        assert benchmark is not None
        assert benchmark.lvis_ap is None
        assert benchmark.gflops == 531.3

    def test_unlisted_weights_have_no_benchmark(self) -> None:
        assert BenchmarkCatalog.bundled().benchmark_of("unknown/model") is None

    def test_every_listed_checkpoint_has_a_detection_preset(self) -> None:
        catalog: PresetCatalog = PresetCatalog.from_packages()
        selector: ModelSelector = ModelSelector(catalog, DeviceAvailability.detect())
        weights_paths: set[str] = set()
        for backend in selector.backends_of(RecognitionTask.DETECTION):
            for preset in selector.presets_of(RecognitionTask.DETECTION, backend):
                model: RecognitionModel = selector.base_model(RecognitionTask.DETECTION, backend, preset.name)
                weights_paths.add(model.weights_path)
        assert set(BenchmarkCatalog.bundled().models) <= weights_paths
