# inference

## Overview

Bridge between the GUI and the model libraries `open_vocabulary_classification`, `open_vocabulary_detector` and `open_vocabulary_segmentation`: discovering presets, building and loading the chosen model, and converting its output into the library-independent results of `results/`.

## Components

| Component | Description |
| --- | --- |
| [benchmarks/](./benchmarks/README.md) | LVIS AP and GFLOPs of the detection checkpoints, read from `catalog.json`. |
| [compute/](./compute/README.md) | Compute device, precision and the GPU backends available on this machine. |
| [execution/](./execution/README.md) | The session keeping one model loaded, the outcome of each mini-batch and the position of a tracker's stream. |
| [licensing/](./licensing/README.md) | Licensed optional modules and the consent required before a model uses them. |
| [models/](./models/README.md) | `RecognitionModel` and `Recognizer` with one directory per kind of model: classification, detection and the five segmentation interfaces. |
| [presets/](./presets/README.md) | Preset discovery, the chosen preset with its overrides, and the selector building a model from it. |
| [profiles/](./profiles/README.md) | Identity of the model and options a result was recognized with. |
| [weights/](./weights/README.md) | Finding, sizing and deleting downloaded weights. |
