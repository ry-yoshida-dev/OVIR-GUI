# picture_prompts

## Overview

Drawings on pictures: `PicturePromptStore` remembers the exemplar boxes and object marks of every task, written as JSON by `PicturePromptCodec`, which the results archive shares.

## Components

| Component | Description |
| --- | --- |
| [codec.py](./codec.py) | `PicturePromptCodec` writes and reads exemplar boxes and object marks as JSON, shared by the results archive and the remembered drawings. |
| [store.py](./store.py) | `PicturePromptStore` remembers the exemplar boxes and object marks drawn on pictures for every task in `picture_prompts.json`. |
