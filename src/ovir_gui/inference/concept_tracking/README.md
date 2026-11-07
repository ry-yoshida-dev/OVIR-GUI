# concept_tracking

## Overview

SAM 3 video concept tracking: `ConceptTrackingModel` holds the settings and `ConceptTrackingRecognizer` follows every instance of the phrases and reference images through the frames.

## Components

| Component | Description |
| --- | --- |
| [recognition_model.py](./recognition_model.py) | `ConceptTrackingModel` holds the settings of the SAM 3 video concept tracker. |
| [recognizer.py](./recognizer.py) | `ConceptTrackingRecognizer` follows every instance of the phrases and reference images through the frames of a video, naming its track. |
