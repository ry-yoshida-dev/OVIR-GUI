# analysis

## Overview

Summaries of stored recognition results for the Statistics window. `ResultStatistics` gathers, for one model profile
after the review, per-class `ClassStatistics` (counts, `ConfidenceSummary` quantiles, a `ThresholdCurve` of what every
minimum would keep and COCO `SizeBand` counts in a `SizeDistribution`), per-picture `PictureStatistics`, and
`ClassMatrix` relations between classes: pictures they share, objects two classes both cover and, for
classifications, runner-up classes with a `ConfidenceHistogram` of top-score margins. `ProfileComparison` pairs the
kept instances of two profiles of the same task with `InstanceMatcher` and reports the differences per class as
`ClassComparison`s, per picture as `PictureDisagreement`s and, for classifications, as a confusion `ClassMatrix`. It
reads results from `results/` and `recognition/` and does not run models.

## Components

| Component | Description |
| --- | --- |
| [statistics/](./statistics/README.md) | Statistics of the reviewed findings of one profile: per class, per picture and the class relations. |
| [comparison/](./comparison/README.md) | Comparison of the kept findings of two profiles of one task, per class and per picture. |
| [class_matrix.py](./class_matrix.py) | `ClassMatrix` counts every ordered pair of classes. |
| [instance_matcher.py](./instance_matcher.py) | `InstanceMatcher` pairs the instances two models found in one picture one-to-one by overlap. |
