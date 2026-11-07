# confidence

## Overview

Summaries of confidences: quantiles, histogram and what every minimum would keep. `ClassStatistics` and `ResultStatistics` use them per class and for the top-score margins of classifications.

## Components

| Component | Description |
| --- | --- |
| [histogram.py](./histogram.py) | `ConfidenceHistogram` counts values in equal-width bins over `[0, 1]`. |
| [summary.py](./summary.py) | `ConfidenceSummary` gives the quantiles and mean of some confidences. |
| [threshold_curve.py](./threshold_curve.py) | `ThresholdCurve` counts the findings and pictures every minimum confidence would keep. |
