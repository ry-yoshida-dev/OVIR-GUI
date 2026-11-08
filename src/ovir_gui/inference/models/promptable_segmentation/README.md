# promptable_segmentation

## Overview

Segmentation of the objects marked by points and boxes on each picture: `PromptableSegmentationModel` holds the settings, `PromptableSegmentationRecognizer` runs it, and `ObjectPromptBuilder` turns an `ObjectMark` into the library `ObjectPrompt`, also used by the object trackers. A promptable preset with a concept preset of the same family and name is not offered on its own; `SegmentationModel` runs it for the marks.

## Components

| Component | Description |
| --- | --- |
| [object_prompt_builder.py](./object_prompt_builder.py) | `ObjectPromptBuilder` turns an `ObjectMark` into the `ObjectPrompt` of `open_vocabulary_segmentation`, keeping the elements the model takes. |
| [recognition_model.py](./recognition_model.py) | `PromptableSegmentationModel` holds the settings of a promptable segmenter (SAM, SAM 2, SAM 3 tracker, EdgeTAM, Florence-2). |
| [recognizer.py](./recognizer.py) | `PromptableSegmentationRecognizer` segments the objects marked on each picture, reusing the encodings of recent pictures. |
