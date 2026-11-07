# weights

## Overview

Downloaded checkpoints: `WeightsStorage` finds the weights of presets in the Hugging Face hub cache and the Ultralytics directories, sizes them as `StoredWeights` and deletes them.

## Components

| Component | Description |
| --- | --- |
| [storage.py](./storage.py) | `WeightsStorage` finds, sizes and deletes downloaded weights in the Hugging Face hub cache (through `huggingface_hub`, keeping files shared with other repositories) and the Ultralytics directories. |
| [stored.py](./stored.py) | `StoredWeights` holds the weights path and disk size of one downloaded checkpoint. |
