# models

## Overview

Bridge between the GUI and the model libraries `open_vocabulary_classification`, `open_vocabulary_detector` and `open_vocabulary_segmentation`. `PresetCatalog` discovers YAML presets, `ModelSelector` turns a `ModelSelection` into a `RecognitionModel`, and `RecognizerSession` keeps one loaded `Recognizer` that converts library output into the `FrameResult`s of `recognition/`. Segmentation offers every interface of `open_vocabulary_segmentation` as a `SegmentationMode`, each with its own model class: phrases, reference images and SAM 3 exemplar boxes (`SegmentationModel`), objects marked by points and boxes (`PromptableSegmentationModel`), every region (`MaskGenerationModel`), marked objects followed through a video (`ObjectTrackingModel`) and phrases or reference images followed through a video (`ConceptTrackingModel`). Each model declares its `PromptMode` and whether it reads video frames in order; the tracking recognizers keep a streaming session per video. `ComputeDevice` and `ComputePrecision` (float32, float16, bfloat16) map onto each library's settings; segmentation precision uses the `Precision` enum of `open_vocabulary_segmentation`. `ModelProfile` tells results of different models and options apart for `results/`. A model reports the `LicensedDependency` modules it is imported from (YOLO-World and YOLOE need Ultralytics, AGPL-3.0); `LicenseConsent` refuses such a model, without importing the module, until the user accepts its license.

## Components

| Component | Description |
| --- | --- |
| [classification_model.py](./classification_model.py) | `ClassificationModel` holds the settings of an `open_vocabulary_classification` classifier (CLIP, SigLIP and variants). |
| [classifier_prompt_builder.py](./classifier_prompt_builder.py) | `ClassifierPromptBuilder` turns a `LabeledPrompt` into the prompt of `open_vocabulary_classification`. |
| [classifier_recognizer.py](./classifier_recognizer.py) | `ClassifierRecognizer` wraps a loaded `open_vocabulary_classification` classifier. |
| [concept_tracking_model.py](./concept_tracking_model.py) | `ConceptTrackingModel` holds the settings of the SAM 3 video concept tracker. |
| [concept_tracking_recognizer.py](./concept_tracking_recognizer.py) | `ConceptTrackingRecognizer` follows every instance of the phrases and reference images through the frames of a video, naming its track. |
| [compute_device.py](./compute_device.py) | `ComputeDevice` enumerates the devices a model runs on, mapped onto each library's device type. |
| [compute_precision.py](./compute_precision.py) | `ComputePrecision` enumerates the floating-point types a model runs in (float32, float16, bfloat16). |
| [detection_model.py](./detection_model.py) | `DetectionModel` holds the settings of an `open_vocabulary_detector` object detector. |
| [detector_prompt_builder.py](./detector_prompt_builder.py) | `DetectorPromptBuilder` turns a `LabeledPrompt` into the prompt of `open_vocabulary_detector`, also used by the segmenters. |
| [detector_recognizer.py](./detector_recognizer.py) | `DetectorRecognizer` wraps a loaded `open_vocabulary_detector` detector. |
| [device_availability.py](./device_availability.py) | `DeviceAvailability` reports the GPU backends present on this machine and which settings can run. |
| [license_consent.py](./license_consent.py) | `LicenseConsent` records the licensed modules the user accepted in this session and refuses models needing others. |
| [licensed_dependency.py](./licensed_dependency.py) | `LicensedDependency` enumerates optional modules of restrictive licenses (Ultralytics, AGPL-3.0) with their terms and install command. |
| [mask_generation_model.py](./mask_generation_model.py) | `MaskGenerationModel` holds the settings of automatic mask generation, segmenting every region without a prompt. |
| [mask_generation_recognizer.py](./mask_generation_recognizer.py) | `MaskGenerationRecognizer` wraps a loaded automatic mask generator. |
| [model_preset.py](./model_preset.py) | `ModelPreset` describes the YAML preset of one model shipped with a model library. |
| [model_profile.py](./model_profile.py) | `ModelProfile` identifies the model and options a result was recognized with. |
| [model_selection.py](./model_selection.py) | `ModelSelection` holds the preset chosen in the model settings with its overrides, including the batch size. |
| [model_selector.py](./model_selector.py) | `ModelSelector` lists the presets of every task and builds the model of a chosen preset with overrides applied. |
| [object_prompt_builder.py](./object_prompt_builder.py) | `ObjectPromptBuilder` turns an `ObjectMark` into the `ObjectPrompt` of `open_vocabulary_segmentation`, keeping the elements the model takes. |
| [object_tracking_model.py](./object_tracking_model.py) | `ObjectTrackingModel` holds the settings of a video object tracker (SAM 2, SAM 3 tracker, EdgeTAM). |
| [object_tracking_recognizer.py](./object_tracking_recognizer.py) | `ObjectTrackingRecognizer` follows the marked objects through the frames of a video from their first mark. |
| [preset_catalog.py](./preset_catalog.py) | `PresetCatalog` discovers model presets of every task from `<root>/<backend>/<name>.yaml`, and from `<root>/<folder>/<family>/<name>.yaml` for nested folders. |
| [profile_option.py](./profile_option.py) | `ProfileOption` holds one setting telling results of the same model apart, e.g. `Conf` = `0.35`. |
| [promptable_recognizer.py](./promptable_recognizer.py) | `PromptableRecognizer` segments the objects marked on each picture, reusing the encodings of recent pictures. |
| [promptable_segmentation_model.py](./promptable_segmentation_model.py) | `PromptableSegmentationModel` holds the settings of a promptable segmenter (SAM, SAM 2, SAM 3 tracker, EdgeTAM, Florence-2). |
| [recognition_model.py](./recognition_model.py) | `RecognitionModel` is the task-independent view of the settings of one model. |
| [recognition_outcome.py](./recognition_outcome.py) | `RecognitionOutcome` holds the results of one mini-batch with what it cost. |
| [recognizer.py](./recognizer.py) | `Recognizer` is a loaded model turning keyed pictures and a prompt into library-independent `FrameResult`s. |
| [recognizer_session.py](./recognizer_session.py) | `RecognizerSession` keeps one loaded model and reloads only when other weights are needed. |
| [segmentation_mode.py](./segmentation_mode.py) | `SegmentationMode` enumerates the segmentation interfaces, each read from its own preset folder. |
| [segmentation_model.py](./segmentation_model.py) | `SegmentationModel` holds the settings of an `open_vocabulary_segmentation` instance segmenter. |
| [segmenter_recognizer.py](./segmenter_recognizer.py) | `SegmenterRecognizer` wraps a loaded `open_vocabulary_segmentation` segmenter, passing SAM 3 the reference images of the prompt and the exemplar boxes of each picture and keeping masks compact as `InstanceMask`s. |
| [stream_position.py](./stream_position.py) | `StreamPosition` tells whether the next picture continues the streaming session of a tracker. |
