# review

## Overview

How the review criteria of the top-level [`review`](../../review/README.md) package are remembered between runs, each in its own JSON file of the data directory: class minimums, duplicate suppression and the label mode of classifications.

## Components

| Component | Description |
| --- | --- |
| [class_thresholds.py](./class_thresholds.py) | `ClassThresholdStore` remembers the minimum confidence per task, class and phrase in `class_thresholds.json`. |
| [duplicate_suppression.py](./duplicate_suppression.py) | `DuplicateSuppressionStore` remembers the review suppression of overlapping boxes per task in `duplicate_suppression.json`. |
| [label_mode.py](./label_mode.py) | `LabelModeStore` remembers the label mode chosen for classifications in `label_mode.json`. |
