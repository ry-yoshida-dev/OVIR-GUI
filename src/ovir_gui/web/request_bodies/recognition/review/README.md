# review

## Overview

Request bodies of reviewing results: accepting or rejecting findings, the order of the result table, the minimum confidences and the suppression of overlapping boxes. `FindingReference` identifies one finding inside them.

## Components

| Component | Description |
| --- | --- |
| [acceptance.py](./acceptance.py) | `AcceptanceBody` lists findings of the shown results to keep or reject. |
| [finding_reference.py](./finding_reference.py) | `FindingReference` identifies one finding of the shown results. |
| [suppression.py](./suppression.py) | `SuppressionBody` sets the review suppression of overlapping boxes for the current task. |
| [table.py](./table.py) | `TableBody` lists the findings of the result table, in display order. |
| [thresholds.py](./thresholds.py) | `ThresholdsBody` sets the minimum confidence of the classes and phrases for the current task. |
