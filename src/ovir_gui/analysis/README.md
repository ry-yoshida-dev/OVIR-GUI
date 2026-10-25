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
| [class_comparison.py](./class_comparison.py) | `ClassComparison` holds the kept findings of one class by the shown and the compared model, with their agreement and matched overlap. |
| [class_matrix.py](./class_matrix.py) | `ClassMatrix` counts every ordered pair of classes. |
| [class_statistics.py](./class_statistics.py) | `ClassStatistics` holds the findings of one class over some pictures. |
| [confidence_histogram.py](./confidence_histogram.py) | `ConfidenceHistogram` counts values in equal-width bins over `[0, 1]`. |
| [confidence_summary.py](./confidence_summary.py) | `ConfidenceSummary` gives the quantiles and mean of some confidences. |
| [instance_matcher.py](./instance_matcher.py) | `InstanceMatcher` pairs the instances two models found in one picture one-to-one by overlap. |
| [picture_disagreement.py](./picture_disagreement.py) | `PictureDisagreement` holds the kept findings of two models on one picture. |
| [picture_statistics.py](./picture_statistics.py) | `PictureStatistics` holds the findings of one recognized picture. |
| [profile_comparison.py](./profile_comparison.py) | `ProfileComparison` compares the kept findings of two profiles of one task on the pictures both recognized. |
| [result_statistics.py](./result_statistics.py) | `ResultStatistics` computes the class, picture and relation statistics of one profile and ranks pictures worth a look. |
| [size_band.py](./size_band.py) | `SizeBand` sorts objects into small, medium and large by the COCO area bounds. |
| [size_distribution.py](./size_distribution.py) | `SizeDistribution` counts the kept findings of one class per size band. |
| [threshold_curve.py](./threshold_curve.py) | `ThresholdCurve` counts the findings and pictures every minimum confidence would keep. |
