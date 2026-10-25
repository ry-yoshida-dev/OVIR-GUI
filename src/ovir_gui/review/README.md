# review

## Overview

Review settings applied to stored results before they are shown or exported, so findings can be filtered without re-running recognition. `ClassThresholds` sets a minimum confidence that a class and, in turn, a phrase can replace; `DuplicateSuppression` removes lower-scored boxes overlapping a better one of their class; `LabelModeChoice` decides whether a classified picture keeps only its best class or every class reaching its minimum, by default following the scores of the model (multi-label for sigmoid, single-label for softmax); `ReviewFilter` lists the findings of the label mode, then applies the minimums and the suppression, in that order. They are persisted by `ClassThresholdStore`, `DuplicateSuppressionStore` and `LabelModeStore` in the `storage` package.

## Components

| Component | Description |
| --- | --- |
| [class_thresholds.py](./class_thresholds.py) | `ClassThresholds` holds the minimum confidence a finding needs: a default one, replaced per class and per phrase. |
| [duplicate_suppression.py](./duplicate_suppression.py) | `DuplicateSuppression` is the class-wise non-maximum suppression of the review, with an overlap replaced per class. |
| [label_mode_choice.py](./label_mode_choice.py) | `LabelModeChoice` is the label mode chosen for classifications, automatic or single- or multi-label. |
| [review_filter.py](./review_filter.py) | `ReviewFilter` decides which findings of a result are listed and which pass the minimums and the suppression. |
