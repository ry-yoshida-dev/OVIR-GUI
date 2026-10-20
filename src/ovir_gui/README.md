# ovir_gui

## Overview

Browser GUI for open-vocabulary image recognition: classification, detection and segmentation of images and videos. A FastAPI server (`web/`) serves a React frontend and drives a `Workspace` (`workspace/`) that loads media (`media/`), builds prompts from text classes and drawn reference boxes (`prompting/`, `vocabulary/`), runs the chosen model (`models/`) and keeps library-independent results (`recognition/`, `results/`). Videos are played in the browser with the VideoPlayerUI player, and the per-frame findings of a whole video are fetched from `GET /api/video-frames`. Results can be reviewed with per-class thresholds (`review/`), compared and summarized (`analysis/`), persisted between runs (`storage/`) and exported (`export/`).

## Components

| Component | Description |
| --- | --- |
| [analysis/](./analysis/README.md) | Per-class statistics, confidence histograms and model-to-model comparison of results. |
| [cli/](./cli/README.md) | `CommandLine` parsing of the `ovir-gui` arguments into `LaunchOptions`. |
| [export/](./export/README.md) | `ResultExporter` and the writers saving results as tables, box/segmentation labels, masks, class folders and annotated media. |
| [media/](./media/README.md) | Image and video files, frame keys, frame sampling and pixel loading. |
| [models/](./models/README.md) | Model presets, settings and loaded recognizers of the classification, detection and segmentation libraries. |
| [prompting/](./prompting/README.md) | Library-independent prompts built from class phrases and reference boxes. |
| [recognition/](./recognition/README.md) | Library-independent result types: `FrameResult`, instances, masks, boxes and findings. |
| [results/](./results/README.md) | `ResultLibrary` keeping one `ResultCatalog` of results per model profile. |
| [review/](./review/README.md) | `ClassThresholds` hiding low-confidence findings per class without recognizing again. |
| [storage/](./storage/README.md) | On-disk stores of class sets, thresholds, results and the session. |
| [vocabulary/](./vocabulary/README.md) | Class definitions and the class list remembered between runs. |
| [web/](./web/README.md) | FastAPI application, routes and launcher serving the React frontend. |
| [workspace/](./workspace/README.md) | `Workspace` state of the open media, classes, inference jobs and exports shared by the web routes. |
| [\_\_main\_\_.py](./__main__.py) | `main` entry point of the `ovir-gui` command: parses the command line and starts the web server. |
