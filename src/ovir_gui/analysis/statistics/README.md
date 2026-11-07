# statistics

## Overview

Statistics of the reviewed findings of one profile: per class, per picture and the class relations. `ResultStatistics` computes them for the Statistics window, with `ClassStatistics` per class and `PictureStatistics` per picture.

## Components

| Component | Description |
| --- | --- |
| [confidence/](./confidence/README.md) | Summaries of confidences: quantiles, histogram and what every minimum would keep. |
| [size/](./size/README.md) | COCO size bands of objects and their counts per class. |
| [per_class.py](./per_class.py) | `ClassStatistics` holds the findings of one class over some pictures. |
| [per_picture.py](./per_picture.py) | `PictureStatistics` holds the findings of one recognized picture. |
| [profile.py](./profile.py) | `ResultStatistics` computes the class, picture and relation statistics of one profile and ranks pictures worth a look. |
