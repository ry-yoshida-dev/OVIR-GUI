# analysis

## Overview

Summaries of stored recognition results for the Statistics window: per-class, per-picture and class-relation statistics of one model profile, and the comparison of two profiles of the same task. It does not run models.

## Components

| Component | Description |
| --- | --- |
| [statistics/](./statistics/README.md) | Statistics of the reviewed findings of one profile: per class, per picture and the class relations. |
| [comparison/](./comparison/README.md) | Comparison of the kept findings of two profiles of one task, per class and per picture. |
| [class_matrix.py](./class_matrix.py) | `ClassMatrix` counts every ordered pair of classes. |
| [instance_matcher.py](./instance_matcher.py) | `InstanceMatcher` pairs the instances two models found in one picture one-to-one by overlap. |
