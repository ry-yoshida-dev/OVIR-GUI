# mask_generation

## Overview

Automatic mask generation segmenting every region without a prompt: `MaskGenerationModel` holds the settings and `MaskGenerationRecognizer` runs it.

## Components

| Component | Description |
| --- | --- |
| [recognition_model.py](./recognition_model.py) | `MaskGenerationModel` holds the settings of automatic mask generation, segmenting every region without a prompt. |
| [recognizer.py](./recognizer.py) | `MaskGenerationRecognizer` wraps a loaded automatic mask generator. |
