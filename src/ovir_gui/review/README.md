# review

## Overview

Review settings applied to stored results before they are shown or exported. `ClassThresholds` sets a minimum confidence per class on top of the model threshold, so findings can be filtered without re-running recognition. The thresholds are persisted by `ClassThresholdStore` in the `storage` package.

## Components

| Component | Description |
| --- | --- |
| [class_thresholds.py](./class_thresholds.py) | `ClassThresholds` holds the minimum confidence a finding needs to be kept, set per class on top of the model threshold. |
