# inference

## Overview

Bridge between the GUI and the model libraries `open_vocabulary_classification`, `open_vocabulary_detector` and `open_vocabulary_segmentation`. `PresetCatalog` discovers YAML presets, `ModelSelector` turns a `ModelSelection` into a `RecognitionModel`, and `RecognizerSession` keeps one loaded `Recognizer` (generic over the model class it runs, which `adopt` checks in one place) that converts library output into the `FrameResult`s of `recognition/`. Segmentation offers every interface of `open_vocabulary_segmentation` as a `SegmentationMode`, each with its own model class: phrases, reference images and SAM 3 exemplar boxes (`SegmentationModel`), objects marked by points and boxes (`PromptableSegmentationModel`), every region (`MaskGenerationModel`), marked objects followed through a video (`ObjectTrackingModel`) and phrases or reference images followed through a video (`ConceptTrackingModel`). Each model declares its `PromptMode`, whether it reads video frames in order, the options of a `ModelSelection` it takes (`fitted`), its `ThresholdControls` and how it is used; the tracking recognizers keep a streaming session per video. `ComputeDevice` and `ComputePrecision` (float32, float16, bfloat16) map onto each library's settings; segmentation precision uses the `Precision` enum of `open_vocabulary_segmentation`. `ModelProfile` tells results of different models and options apart for `results/`. `WeightsStorage` finds the downloaded weights of presets in the Hugging Face hub cache and the Ultralytics directories, sizes them as `StoredWeights` and deletes them. `BenchmarkCatalog` reads the LVIS AP and GFLOPs of the detection checkpoints, by weights path, from the bundled `benchmarks/catalog.json` for the model table. A model reports the `LicensedDependency` modules it is imported from (YOLO-World and YOLOE need Ultralytics, AGPL-3.0); `LicenseConsent` refuses such a model, without importing the module, until the user accepts its license.

## Components

| Component | Description |
| --- | --- |
| [benchmarks/](./benchmarks/README.md) | LVIS AP and GFLOPs of the detection checkpoints, read from `catalog.json`. |
| [classification/](./classification/README.md) | Classifier settings, recognizer, prompt and query layout, and scoring of text-vector logits. |
| [compute/](./compute/README.md) | Compute device, precision and the GPU backends available on this machine. |
| [concept_tracking/](./concept_tracking/README.md) | Video concept tracker settings and recognizer. |
| [detection/](./detection/README.md) | Detector settings, recognizer and the detector prompt shared with the segmenters. |
| [licensing/](./licensing/README.md) | Licensed optional modules and the consent required before a model uses them. |
| [mask_generation/](./mask_generation/README.md) | Automatic mask generator settings and recognizer. |
| [object_tracking/](./object_tracking/README.md) | Video object tracker settings and recognizer. |
| [presets/](./presets/README.md) | Preset discovery and the selector building a model from a chosen preset. |
| [promptable_segmentation/](./promptable_segmentation/README.md) | Promptable segmenter settings, recognizer and the object prompt shared with the object trackers. |
| [segmentation/](./segmentation/README.md) | Instance segmenter settings and recognizer. |
| [weights/](./weights/README.md) | Finding, sizing and deleting downloaded weights. |
| [model_profile.py](./model_profile.py) | `ModelProfile` identifies the model and options a result was recognized with. |
| [model_selection.py](./model_selection.py) | `ModelSelection` holds the preset chosen in the model settings with its overrides, including the batch size. |
| [profile_option.py](./profile_option.py) | `ProfileOption` holds one setting telling results of the same model apart, e.g. `Conf` = `0.35`. |
| [recognition_model.py](./recognition_model.py) | `RecognitionModel` is the task-independent view of the settings of one model. |
| [recognition_outcome.py](./recognition_outcome.py) | `RecognitionOutcome` holds the results of one mini-batch with what it cost. |
| [recognizer.py](./recognizer.py) | `Recognizer` is a loaded model turning keyed pictures and a prompt into library-independent `FrameResult`s. |
| [recognizer_session.py](./recognizer_session.py) | `RecognizerSession` keeps one loaded model and reloads only when other weights are needed. |
| [segmentation_mode.py](./segmentation_mode.py) | `SegmentationMode` enumerates the segmentation interfaces, each read from its own preset folder and heading its group of models. |
| [stream_position.py](./stream_position.py) | `StreamPosition` tells whether the next picture continues the streaming session of a tracker. |
| [threshold_controls.py](./threshold_controls.py) | `ThresholdControls` tells which threshold settings a model reads, shown with its settings. |
