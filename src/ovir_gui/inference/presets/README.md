# presets

## Overview

The YAML presets shipped with the model libraries: `PresetCatalog` discovers them, `PresetReference` names one, `BackendTraits` holds the options of a model family, and `ModelSelector` builds the model of a chosen preset with the overrides of a `ModelSelection`.

## Components

| Component | Description |
| --- | --- |
| [backend_traits.py](./backend_traits.py) | `BackendTraits` holds the options a model family offers: image poolings, detector boxes and segmentation mode. |
| [catalog.py](./catalog.py) | `PresetCatalog` discovers model presets of every task from `<root>/<backend>/<name>.yaml`, and from `<root>/<folder>/<family>/<name>.yaml` for nested folders. |
| [model.py](./model.py) | `ModelPreset` describes the YAML preset of one model shipped with a model library. |
| [reference.py](./reference.py) | `PresetReference` names one preset of the catalog by task, model family and preset name. |
| [selector.py](./selector.py) | `ModelSelector` lists the presets of every task and builds the model of a chosen preset with overrides applied. |
