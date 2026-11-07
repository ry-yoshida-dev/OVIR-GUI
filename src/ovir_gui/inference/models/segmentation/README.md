# segmentation

## Overview

Instance segmentation of phrases, reference images and SAM 3 exemplar boxes with `open_vocabulary_segmentation`: `SegmentationModel` holds the settings and `SegmentationRecognizer` runs it.

## Components

| Component | Description |
| --- | --- |
| [recognition_model.py](./recognition_model.py) | `SegmentationModel` holds the settings of an `open_vocabulary_segmentation` instance segmenter. |
| [recognizer.py](./recognizer.py) | `SegmentationRecognizer` wraps a loaded `open_vocabulary_segmentation` segmenter, passing SAM 3 the reference images of the prompt and the exemplar boxes of each picture and keeping masks compact as `InstanceMask`s. |
