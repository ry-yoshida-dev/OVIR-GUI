# exporting

## Overview

Exports of the workspace: `ExportCoordinator` plans an `ExportRequest` as an `ExportPlan` and writes the stored results off the owning thread, and `ExportPreviewSource` holds what a label preview is written from.

## Components

| Component | Description |
| --- | --- |
| [coordinator.py](./coordinator.py) | `ExportCoordinator` plans the export of the images or the videos, writes their stored results off the owning thread, leaving out pictures not yet inferred, and gathers what a label preview is written from. |
| [plan.py](./plan.py) | `ExportPlan` describes what an export of the images or the videos would write now. |
| [preview_source.py](./preview_source.py) | `ExportPreviewSource` holds what a label preview is written from, gathered on the owning thread. |
| [request.py](./request.py) | `ExportRequest` is the export chosen by the user. |
