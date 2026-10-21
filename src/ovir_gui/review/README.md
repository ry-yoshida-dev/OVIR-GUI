# review

## Overview

Review settings applied to stored results before they are shown or exported, so findings can be filtered without re-running recognition. `ClassThresholds` sets a minimum confidence that a class and, in turn, a phrase can replace; `DuplicateSuppression` removes lower-scored boxes overlapping a better one of their class; `ReviewFilter` applies both, in that order. They are persisted by `ClassThresholdStore` and `DuplicateSuppressionStore` in the `storage` package.

## Components

| Component | Description |
| --- | --- |
| [class_thresholds.py](./class_thresholds.py) | `ClassThresholds` holds the minimum confidence a finding needs: a default one, replaced per class and per phrase. |
| [duplicate_suppression.py](./duplicate_suppression.py) | `DuplicateSuppression` is the class-wise non-maximum suppression of the review, with an overlap replaced per class. |
| [review_filter.py](./review_filter.py) | `ReviewFilter` decides which findings of a result pass the minimums and the suppression. |
