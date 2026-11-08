# profiles

## Overview

Identity of the model and options a result was recognized with: `ModelProfile` tells results of different models and options apart for `results/in_memory/`, each setting held as a `ProfileOption`.

## Components

| Component | Description |
| --- | --- |
| [model.py](./model.py) | `ModelProfile` identifies the model and options a result was recognized with. |
| [option.py](./option.py) | `ProfileOption` holds one setting telling results of the same model apart, e.g. `Conf` = `0.35`. |
