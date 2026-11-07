# model_settings

## Overview

Request bodies of the model settings: the task, the preset and its overrides, accepted licenses, downloaded weights, the label mode of classifications and the text templates of classifiers.

## Components

| Component | Description |
| --- | --- |
| [aggregation_step.py](./aggregation_step.py) | `AggregationStepBody` is one step merging the prompts or templates of a classifier class: unit, timing and method. |
| [label_mode.py](./label_mode.py) | `LabelModeBody` sets the label mode of classifications: single- or multi-label. |
| [license.py](./license.py) | `LicenseBody` names the licensed module whose license the user accepted. |
| [preset.py](./preset.py) | `PresetBody` chooses a preset with its own values. |
| [selection.py](./selection.py) | `ModelSelectionBody` carries the preset and overrides chosen in the model settings. |
| [task.py](./task.py) | `TaskBody` names the task to switch to. |
| [text_templates.py](./text_templates.py) | `TextTemplatesBody` carries the text templates saved for reuse by classifiers. |
| [weights.py](./weights.py) | `WeightsBody` names the downloaded weights of a preset to delete. |
