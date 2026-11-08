# segmentation

## Overview

Instance segmentation of phrases, reference images and SAM 3 exemplar boxes with `open_vocabulary_segmentation`, together with the objects marked by points and boxes on each picture when the family has a promptable preset of the same name: `SegmentationModel` holds the settings and `SegmentationRecognizer` runs it.

## Components

| Component | Description |
| --- | --- |
| [recognition_model.py](./recognition_model.py) | `SegmentationModel` holds the settings of an `open_vocabulary_segmentation` instance segmenter. |
| [recognizer.py](./recognizer.py) | `SegmentationRecognizer` wraps a loaded `open_vocabulary_segmentation` segmenter, passing SAM 3 the reference images of the prompt and the exemplar boxes of each picture, segmenting the marked objects with the promptable segmenter (the one masking the detector boxes for SAM, SAM 2 and EdgeTAM) and keeping masks compact as `InstanceMask`s. |
