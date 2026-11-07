# object_tracking

## Overview

Video object tracking from the first mark of each object: `ObjectTrackingModel` holds the settings of a tracker and `ObjectTrackingRecognizer` follows the marked objects through the frames.

## Components

| Component | Description |
| --- | --- |
| [recognition_model.py](./recognition_model.py) | `ObjectTrackingModel` holds the settings of a video object tracker (SAM 2, SAM 3 tracker, EdgeTAM). |
| [recognizer.py](./recognizer.py) | `ObjectTrackingRecognizer` follows the marked objects through the frames of a video from their first mark. |
