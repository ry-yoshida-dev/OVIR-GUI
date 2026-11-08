# ovir_gui

## Overview

Python package of OVIR-GUI: a FastAPI server (`web/`) serving the React frontend and driving the `Workspace` (`workspace/`), which loads media, builds prompts, runs the chosen model and keeps, reviews, analyzes, stores and exports its results.

## Components

| Component | Description |
| --- | --- |
| [analysis/](./analysis/README.md) | Class, picture and class-relation statistics of results and model-to-model comparison. |
| [cli/](./cli/README.md) | `CommandLine` parsing of the `ovir-gui` arguments into `LaunchOptions`. |
| [export/](./export/README.md) | `ResultExporter` and the writers saving results as tables, box/segmentation labels, masks, class folders and annotated media. |
| [external_programs/](./external_programs/README.md) | External programs made available at start: FFmpeg for torchcodec, downloaded on Windows. |
| [inference/](./inference/README.md) | Model settings and loaded recognizers of every task, with presets, weights, benchmarks, compute settings and licensing. |
| [media/](./media/README.md) | Image and video files, frame keys, frame sampling and pixel loading. |
| [prompting/](./prompting/README.md) | Library-independent prompts built from class phrases and reference boxes. |
| [results/](./results/README.md) | Library-independent result types (`FrameResult`, instances, masks, boxes and findings) and the `ResultLibrary` keeping the latest of them per model profile. |
| [review/](./review/README.md) | `ClassThresholds` hiding low-confidence findings per class without recognizing again. |
| [storage/](./storage/README.md) | On-disk stores of class sets, thresholds, results and the session. |
| [vocabulary/](./vocabulary/README.md) | Class definitions and the class list remembered between runs. |
| [web/](./web/README.md) | FastAPI application, routes and launcher serving the React frontend. |
| [wording/](./wording/README.md) | `CountedNoun` writing counts with singular or plural nouns in user-facing messages. |
| [workspace/](./workspace/README.md) | `Workspace` state of the open media, classes, inference jobs and exports shared by the web routes. |
| [\_\_main\_\_.py](./__main__.py) | `main` entry point of the `ovir-gui` command: parses the command line, makes FFmpeg available and starts the web server. |
