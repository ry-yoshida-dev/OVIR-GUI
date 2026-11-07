# classification

## Overview

What a classifier reports for a whole picture. `ClassScore`s are computed from the `EmbeddingLogit`s kept in `ClassifierLogits`, so they can be computed again with other aggregation steps, and `LabelMode` tells whether a picture is labelled with its best class or every class reaching its minimum.

## Components

| Component | Description |
| --- | --- |
| [class_score.py](./class_score.py) | `ClassScore` holds the score of one class for a whole image, as a classifier reports it. |
| [embedding_logit.py](./embedding_logit.py) | `EmbeddingLogit` is the logit of one text vector of a class: a phrase in one text template, a reference image, or a group of them merged on text vectors. |
| [label_mode.py](./label_mode.py) | `LabelMode` tells whether a picture is labelled with its best class only or with every class reaching its minimum. |
| [logits.py](./logits.py) | `ClassifierLogits` keeps the logit of every text vector of a classified picture, so its class scores can be computed again with other aggregation steps on similarities. |
