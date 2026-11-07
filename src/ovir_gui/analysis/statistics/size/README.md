# size

## Overview

COCO size bands of objects and their counts per class, shown in the class statistics.

## Components

| Component | Description |
| --- | --- |
| [band.py](./band.py) | `SizeBand` sorts objects into small, medium and large by the COCO area bounds. |
| [distribution.py](./distribution.py) | `SizeDistribution` counts the kept findings of one class per size band. |
