# detection

## Overview

Object detection with `open_vocabulary_detector`: `DetectionModel` holds the settings of a detector and `DetectionRecognizer` runs it. `DetectorPromptBuilder` turns a `LabeledPrompt` into the detector prompt and is also used by the segmenters reading phrases.

## Components

| Component | Description |
| --- | --- |
| [prompt_builder.py](./prompt_builder.py) | `DetectorPromptBuilder` turns a `LabeledPrompt` into the prompt of `open_vocabulary_detector`, also used by the segmenters. |
| [recognition_model.py](./recognition_model.py) | `DetectionModel` holds the settings of an `open_vocabulary_detector` object detector. |
| [recognizer.py](./recognizer.py) | `DetectionRecognizer` wraps a loaded `open_vocabulary_detector` detector. |
