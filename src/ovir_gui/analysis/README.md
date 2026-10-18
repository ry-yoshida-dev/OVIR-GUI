# analysis

## Overview

Summaries of stored recognition results for the analysis views. `ResultStatistics` gathers per-class `ClassStatistics` and `ConfidenceHistogram`s of one model profile, while `ProfileComparison` pairs the instances of two profiles of the same task with `InstanceMatcher` and reports the differences class by class as `ClassComparison`s. It reads results from `results/` and `recognition/` and does not run models.

## Components

| Component | Description |
| --- | --- |
| [class_comparison.py](./class_comparison.py) | `ClassComparison` holds the findings of one class by the shown and the compared model on the pictures both recognized. |
| [class_statistics.py](./class_statistics.py) | `ClassStatistics` holds the findings of one class over some pictures. |
| [confidence_histogram.py](./confidence_histogram.py) | `ConfidenceHistogram` counts detections in equal-width confidence bins over `[0, 1]`. |
| [instance_matcher.py](./instance_matcher.py) | `InstanceMatcher` pairs the instances two models found in one picture one-to-one by overlap. |
| [profile_comparison.py](./profile_comparison.py) | `ProfileComparison` compares two profiles of one task class by class on the pictures both recognized. |
| [result_statistics.py](./result_statistics.py) | `ResultStatistics` computes per-class statistics of the findings of one profile over some pictures. |
