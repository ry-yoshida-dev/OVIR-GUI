# comparison

## Overview

Comparison of the kept findings of two profiles of one task, per class and per picture. `ProfileComparison` pairs the kept instances with `InstanceMatcher` and reports `ClassComparison`s, `PictureDisagreement`s and, for classifications, a confusion `ClassMatrix`.

## Components

| Component | Description |
| --- | --- |
| [per_class.py](./per_class.py) | `ClassComparison` holds the kept findings of one class by the shown and the compared model, with their agreement and matched overlap. |
| [per_picture.py](./per_picture.py) | `PictureDisagreement` holds the kept findings of two models on one picture. |
| [profile.py](./profile.py) | `ProfileComparison` compares the kept findings of two profiles of one task on the pictures both recognized. |
