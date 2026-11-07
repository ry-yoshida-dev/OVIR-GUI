# staleness

## Overview

What a prompt queried on each picture, kept with a result so it can tell whether and how its classes changed since. A `PromptSignature` lists the `QueriedClass`es of one picture, drawings included, and `PromptChange` compares a recorded signature with the current one.

## Components

| Component | Description |
| --- | --- |
| [change.py](./change.py) | `PromptChange` describes how the classes have changed since a result was detected. |
| [queried_class.py](./queried_class.py) | `QueriedClass` holds one class as a prompt queries it on a picture: phrases, reference boxes, exemplar boxes and object marks. |
| [signature.py](./signature.py) | `PromptSignature` captures what a prompt queries class by class, independent of query order and cached embeddings. |
