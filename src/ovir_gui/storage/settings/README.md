# settings

## Overview

Settings remembered between runs, each in its own JSON file: class minimums, duplicate suppression, the label mode of classifications, accepted licenses and the text templates saved for classifiers.

## Components

| Component | Description |
| --- | --- |
| [class_thresholds.py](./class_thresholds.py) | `ClassThresholdStore` remembers the minimum confidence per task, class and phrase in `class_thresholds.json`. |
| [duplicate_suppression.py](./duplicate_suppression.py) | `DuplicateSuppressionStore` remembers the review suppression of overlapping boxes per task in `duplicate_suppression.json`. |
| [label_mode.py](./label_mode.py) | `LabelModeStore` remembers the label mode chosen for classifications in `label_mode.json`. |
| [license_consent.py](./license_consent.py) | `LicenseConsentStore` remembers the licenses of optional modules the user accepted, and when, in `license_consent.json`. |
| [text_templates.py](./text_templates.py) | `TextTemplateStore` remembers the text templates saved for reuse by classifiers in `text_templates.json`. |
