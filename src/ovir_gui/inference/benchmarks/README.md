# benchmarks

## Overview

Accuracy and compute of the detection checkpoints shown in the model table: `BenchmarkCatalog` reads the LVIS AP and GFLOPs of every checkpoint, by weights path, from the bundled `catalog.json`.

## Components

| Component | Description |
| --- | --- |
| [catalog.json](./catalog.json) | `BenchmarkCatalog` data: LVIS AP and GFLOPs of every detection checkpoint, keyed by weights path. |
| [catalog.py](./catalog.py) | `BenchmarkCatalog` holds the accuracy and compute of the detection checkpoints, read from `benchmarks/catalog.json`. |
| [lvis_split.py](./lvis_split.py) | `LvisSplit` enumerates the LVIS splits an AP is reported on (minival, val). |
| [model.py](./model.py) | `ModelBenchmark` holds the LVIS AP and GFLOPs of one checkpoint. |
