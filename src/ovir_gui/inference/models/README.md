# models

## Overview

The models a preset builds: `RecognitionModel` is the task-independent view of the settings of one model and `Recognizer` the loaded model turning keyed pictures and a prompt into the `FrameResult`s of `recognition/`. Each kind of model has its own directory holding its settings and recognizer: classification, detection and the five segmentation interfaces of `open_vocabulary_segmentation`. `ThresholdControls` tells which threshold settings a model reads.

## Components

| Component | Description |
| --- | --- |
| [classification/](./classification/README.md) | Classifier settings, recognizer, prompt and query layout, and scoring of text-vector logits. |
| [concept_tracking/](./concept_tracking/README.md) | Video concept tracker settings and recognizer. |
| [detection/](./detection/README.md) | Detector settings, recognizer and the detector prompt shared with the segmenters. |
| [mask_generation/](./mask_generation/README.md) | Automatic mask generator settings and recognizer. |
| [object_tracking/](./object_tracking/README.md) | Video object tracker settings and recognizer. |
| [promptable_segmentation/](./promptable_segmentation/README.md) | Promptable segmenter settings, recognizer and the object prompt shared with the object trackers. |
| [segmentation/](./segmentation/README.md) | Instance segmenter settings and recognizer. |
| [recognition_model.py](./recognition_model.py) | `RecognitionModel` is the task-independent view of the settings of one model. |
| [recognizer.py](./recognizer.py) | `Recognizer` is a loaded model turning keyed pictures and a prompt into library-independent `FrameResult`s. |
| [threshold_controls.py](./threshold_controls.py) | `ThresholdControls` tells which threshold settings a model reads, shown with its settings. |
