# models

## Overview

Bridge between the GUI and the model libraries `open_vocabulary_classification`, `open_vocabulary_detector` and `open_vocabulary_segmentation`. `PresetCatalog` discovers YAML presets, `ModelSelector` turns a `ModelSelection` into a `RecognitionModel` (`ClassificationModel`, `DetectionModel` or `SegmentationModel`), and `RecognizerSession` keeps one loaded `Recognizer` that converts library output into the `FrameResult`s of `recognition/`. `ComputeDevice` and `ComputePrecision` (float32, float16, bfloat16) map onto each library's settings; segmentation precision uses the `Precision` enum of `open_vocabulary_segmentation`. `ModelProfile` tells results of different models and options apart for `results/`.

## Components

| Component | Description |
| --- | --- |
| [classification_model.py](./classification_model.py) | `ClassificationModel` holds the settings of an `open_vocabulary_classification` classifier (CLIP, SigLIP and variants). |
| [classifier_prompt_builder.py](./classifier_prompt_builder.py) | `ClassifierPromptBuilder` turns a `LabeledPrompt` into the prompt of `open_vocabulary_classification`. |
| [classifier_recognizer.py](./classifier_recognizer.py) | `ClassifierRecognizer` wraps a loaded `open_vocabulary_classification` classifier. |
| [compute_device.py](./compute_device.py) | `ComputeDevice` enumerates the devices a model runs on, mapped onto each library's device type. |
| [compute_precision.py](./compute_precision.py) | `ComputePrecision` enumerates the floating-point types a model runs in (float32, float16, bfloat16). |
| [detection_model.py](./detection_model.py) | `DetectionModel` holds the settings of an `open_vocabulary_detector` object detector. |
| [detector_prompt_builder.py](./detector_prompt_builder.py) | `DetectorPromptBuilder` turns a `LabeledPrompt` into the prompt of `open_vocabulary_detector`, also used by the segmenters. |
| [detector_recognizer.py](./detector_recognizer.py) | `DetectorRecognizer` wraps a loaded `open_vocabulary_detector` detector. |
| [device_availability.py](./device_availability.py) | `DeviceAvailability` reports the GPU backends present on this machine and which settings can run. |
| [model_preset.py](./model_preset.py) | `ModelPreset` describes the YAML preset of one model shipped with a model library. |
| [model_profile.py](./model_profile.py) | `ModelProfile` identifies the model and options a result was recognized with. |
| [model_selection.py](./model_selection.py) | `ModelSelection` holds the preset chosen in the model settings with its overrides. |
| [model_selector.py](./model_selector.py) | `ModelSelector` lists the presets of every task and builds the model of a chosen preset with overrides applied. |
| [preset_catalog.py](./preset_catalog.py) | `PresetCatalog` discovers model presets of every task from `<root>/<backend>/<name>.yaml`. |
| [profile_option.py](./profile_option.py) | `ProfileOption` holds one setting telling results of the same model apart, e.g. `Conf` = `0.35`. |
| [recognition_model.py](./recognition_model.py) | `RecognitionModel` is the task-independent view of the settings of one model. |
| [recognition_outcome.py](./recognition_outcome.py) | `RecognitionOutcome` holds the results of one mini-batch with what it cost. |
| [recognizer.py](./recognizer.py) | `Recognizer` is a loaded model turning images and a prompt into library-independent `FrameResult`s. |
| [recognizer_session.py](./recognizer_session.py) | `RecognizerSession` keeps one loaded model and reloads only when other weights are needed. |
| [segmentation_model.py](./segmentation_model.py) | `SegmentationModel` holds the settings of an `open_vocabulary_segmentation` instance segmenter. |
| [segmenter_recognizer.py](./segmenter_recognizer.py) | `SegmenterRecognizer` wraps a loaded `open_vocabulary_segmentation` segmenter, keeping masks compact as `InstanceMask`s. |
