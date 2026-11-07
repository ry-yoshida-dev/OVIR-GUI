# inference

## Overview

Bridge between the GUI and the model libraries `open_vocabulary_classification`, `open_vocabulary_detector` and `open_vocabulary_segmentation`. `PresetCatalog` discovers YAML presets, `ModelSelector` turns a `ModelSelection` into a `RecognitionModel`, and `RecognizerSession` keeps one loaded `Recognizer` (generic over the model class it runs, which `adopt` checks in one place) that converts library output into the `FrameResult`s of `recognition/`. Segmentation offers every interface of `open_vocabulary_segmentation` as a `SegmentationMode`, each with its own model class: phrases, reference images and SAM 3 exemplar boxes (`SegmentationModel`), objects marked by points and boxes (`PromptableSegmentationModel`), every region (`MaskGenerationModel`), marked objects followed through a video (`ObjectTrackingModel`) and phrases or reference images followed through a video (`ConceptTrackingModel`). Each model declares its `PromptMode`, whether it reads video frames in order, the options of a `ModelSelection` it takes (`fitted`), its `ThresholdControls` and how it is used; the tracking recognizers keep a streaming session per video. `ComputeDevice` and `ComputePrecision` (float32, float16, bfloat16) map onto each library's settings; segmentation precision uses the `Precision` enum of `open_vocabulary_segmentation`. `ModelProfile` tells results of different models and options apart for `results/`. `WeightsStorage` finds the downloaded weights of presets in the Hugging Face hub cache and the Ultralytics directories, sizes them as `StoredWeights` and deletes them. `BenchmarkCatalog` reads the LVIS AP and GFLOPs of the detection checkpoints, by weights path, from the bundled `benchmarks/catalog.json` for the model table. A model reports the `LicensedDependency` modules it is imported from (YOLO-World and YOLOE need Ultralytics, AGPL-3.0); `LicenseConsent` refuses such a model, without importing the module, until the user accepts its license.

## Components

| Component | Description |
| --- | --- |
| [benchmarks/](./benchmarks/README.md) | LVIS AP and GFLOPs of the detection checkpoints, read from `catalog.json`. |
| [compute/](./compute/README.md) | Compute device, precision and the GPU backends available on this machine. |
| [execution/](./execution/README.md) | The session keeping one model loaded, the outcome of each mini-batch and the position of a tracker's stream. |
| [licensing/](./licensing/README.md) | Licensed optional modules and the consent required before a model uses them. |
| [models/](./models/README.md) | `RecognitionModel` and `Recognizer` with one directory per kind of model: classification, detection and the five segmentation interfaces. |
| [presets/](./presets/README.md) | Preset discovery, the chosen preset with its overrides, and the selector building a model from it. |
| [profiles/](./profiles/README.md) | Identity of the model and options a result was recognized with. |
| [weights/](./weights/README.md) | Finding, sizing and deleting downloaded weights. |
