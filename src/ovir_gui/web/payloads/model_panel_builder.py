from ...models import (
    BackendTraits,
    BenchmarkCatalog,
    ComputeDevice,
    ComputePrecision,
    DeviceAvailability,
    LicenseConsent,
    LicensedDependency,
    ModelBenchmark,
    ModelSelection,
    ModelSelector,
    RecognitionModel,
    SegmentationMode,
    TemplateCombination,
    ThresholdControls,
)
from ...prompting import QueryKind
from ...recognition import RecognitionTask
from ...workspace import Workspace
from ..json_value import JsonObject, JsonValue


class ModelPanelBuilder:
    """
    JSON document of the model settings: the presets of every backend of the current task, the chosen model with its
    overrides, the devices and precisions this machine runs, and the licenses of optional modules. Each preset carries
    what it takes and, for listed detection checkpoints, its accuracy and compute.

    Drawings are offered whenever some preset of the task reads them, whatever the chosen model, so the user draws
    the queries of a class once and every model reads those it takes.
    """

    def __init__(self, benchmarks: BenchmarkCatalog) -> None:
        """
        Parameters
        ----------
        benchmarks : BenchmarkCatalog
            Accuracy and compute of the detection checkpoints.
        """
        self._benchmarks: BenchmarkCatalog = benchmarks

    def model(self, workspace: Workspace) -> JsonObject:
        """
        Model settings of the current task.

        Parameters
        ----------
        workspace : Workspace
            Workspace of the server.

        Returns
        -------
        JsonObject
            Backends with their presets, the segmentation modes grouping them, the drawings of the task and whether
            the chosen model reads each, what the chosen model takes, the text templates in use and saved, devices,
            precisions, box detectors, licenses and the current selection.
        """
        selector: ModelSelector = workspace.models.model_selector
        selection: ModelSelection = workspace.models.selection
        model: RecognitionModel = workspace.models.current_model()
        task: RecognitionTask = workspace.task
        traits_by_backend: dict[str, BackendTraits] = {
            backend: selector.traits_of(task, backend) for backend in selector.backends_of(task)
        }
        models_by_backend: dict[str, tuple[RecognitionModel, ...]] = {
            backend: tuple(
                selector.base_model(task, backend, preset.name) for preset in selector.presets_of(task, backend)
            )
            for backend in traits_by_backend
        }
        offered_kinds: frozenset[QueryKind] = frozenset(
            kind
            for backend_models in models_by_backend.values()
            for preset_model in backend_models
            for kind in preset_model.supported_query_kinds
        )
        backends: list[JsonValue] = [
            {
                "value": backend,
                "presets": [self._preset_entry(preset_model) for preset_model in models_by_backend[backend]],
                "image_poolings": list[JsonValue](traits.image_poolings),
                "is_box_prompted": traits.is_box_prompted,
                "mode": self._mode_value(traits.segmentation_mode),
            }
            for backend, traits in traits_by_backend.items()
        ]
        modes: list[JsonValue] = [
            {"value": mode.value, "title": mode.title}
            for mode in dict.fromkeys(
                traits.segmentation_mode
                for traits in traits_by_backend.values()
                if traits.segmentation_mode is not None
            )
        ]
        availability: DeviceAvailability = selector.device_availability
        text_templates: tuple[str, ...] | None = model.text_templates
        template_combination: TemplateCombination | None = model.template_combination
        return {
            "backends": backends,
            "modes": modes,
            "drawing_kinds": [
                {"value": kind.value, "is_used": kind in model.supported_query_kinds}
                for kind in QueryKind
                if kind in offered_kinds and kind.is_drawn_on_picture
            ],
            "is_sequential": model.is_sequential,
            "is_point_supported": model.is_point_supported,
            "tuning": self._tuning(model.threshold_controls),
            "devices": [
                {"value": device.value, "is_available": availability.is_available(device)} for device in ComputeDevice
            ],
            "precisions": [
                {
                    "value": precision.value,
                    "label": precision.short_name,
                    "is_available": precision in model.supported_precisions
                    and availability.is_precision_supported(selection.device, precision),
                }
                for precision in ComputePrecision
            ],
            "box_detectors": [
                {"label": label, "licenses": self._licenses_of(selector.box_detector_model(label))}
                for label in selector.box_detector_labels_of(task)
            ],
            "licenses": self._license_entries(workspace.models.license_consent),
            "selection": self._selection(selection),
            "is_image_prompt_supported": workspace.models.is_image_prompt_supported(),
            "text_templates": None if text_templates is None else list[JsonValue](text_templates),
            "saved_templates": list[JsonValue](workspace.text_templates.templates),
            "template_combination": None if template_combination is None else template_combination.value,
            "template_combinations": [
                {"value": combination.value, "title": combination.title} for combination in TemplateCombination
            ],
            "weights_path": model.weights_path,
            "description": model.usage_description,
            "benchmark_phrase_count": self._benchmarks.phrase_count,
        }

    def _preset_entry(self, model: RecognitionModel) -> JsonObject:
        benchmark: ModelBenchmark | None = self._benchmarks.benchmark_of(model.weights_path)
        return {
            "name": model.preset.name,
            "label": model.preset.label,
            "licenses": self._licenses_of(model),
            "weights_path": model.weights_path,
            "prompt_mode": model.prompt_mode.value,
            "query_kinds": list[JsonValue](sorted(kind.value for kind in model.supported_query_kinds)),
            "is_sequential": model.is_sequential,
            "benchmark": None if benchmark is None else self._benchmark_entry(benchmark),
        }

    @staticmethod
    def _benchmark_entry(benchmark: ModelBenchmark) -> JsonObject:
        return {
            "lvis_ap": benchmark.lvis_ap,
            "lvis_split": None if benchmark.lvis_split is None else benchmark.lvis_split.value,
            "is_lvis_zero_shot": benchmark.is_lvis_zero_shot,
            "gflops": benchmark.gflops,
        }

    @staticmethod
    def _mode_value(mode: SegmentationMode | None) -> JsonValue:
        return None if mode is None else mode.value

    @staticmethod
    def _tuning(controls: ThresholdControls) -> JsonObject:
        return {
            "confidence_label": controls.confidence_label,
            "is_nms_shown": controls.is_nms_shown,
            "is_minimum_confidence_shown": controls.is_minimum_confidence_shown,
        }

    @staticmethod
    def _licenses_of(model: RecognitionModel) -> list[JsonValue]:
        return [dependency.value for dependency in sorted(model.licensed_dependencies, key=lambda entry: entry.value)]

    @staticmethod
    def _license_entries(consent: LicenseConsent) -> list[JsonValue]:
        return [
            {
                "value": dependency.value,
                "title": dependency.title,
                "license_name": dependency.license_name,
                "license_url": dependency.license_url,
                "notice": dependency.notice,
                "install_command": dependency.install_command,
                "is_installed": dependency.is_installed,
                "is_accepted": consent.is_accepted(dependency),
            }
            for dependency in LicensedDependency
        ]

    @staticmethod
    def _selection(selection: ModelSelection) -> JsonObject:
        return {
            "backend": selection.backend,
            "preset_name": selection.preset_name,
            "device": selection.device.value,
            "precision": selection.precision.value,
            "confidence_threshold": selection.confidence_threshold,
            "nms_iou_threshold": selection.nms_iou_threshold,
            "image_pooling": selection.image_pooling,
            "box_detector_label": selection.box_detector_label,
            "tiling_grid_size": selection.tiling_grid_size,
            "text_templates": None if selection.text_templates is None else list[JsonValue](selection.text_templates),
            "template_combination": None
            if selection.template_combination is None
            else selection.template_combination.value,
            "batch_size": selection.batch_size,
        }
