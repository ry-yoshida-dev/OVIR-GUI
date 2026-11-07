# review

## Overview

Review settings applied to stored results before they are shown or exported, so findings can be filtered without recognizing again: minimum confidences, duplicate suppression and the label mode of classifications. The `storage` package persists them.

## Components

| Component | Description |
| --- | --- |
| [class_thresholds.py](./class_thresholds.py) | `ClassThresholds` holds the minimum confidence a finding needs: a default one, replaced per class and per matched prompt. |
| [duplicate_suppression.py](./duplicate_suppression.py) | `DuplicateSuppression` is the class-wise non-maximum suppression of the review, with an overlap replaced per class. |
| [filter.py](./filter.py) | `ReviewFilter` decides which findings of a result are listed and which pass the minimums and the suppression. |
