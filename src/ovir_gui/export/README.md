# export

## Overview

Writing reviewed results to disk. `ResultExporter` takes the `ExportItem`s selected by `ExportSelection`, writes them in the chosen `ExportFormat` (CSV/JSON tables, box formats of `object_detection_format`, mask formats of `segmentation_format`, classification formats of `classification_format`, mask images, class folders, cropped objects) and optionally saves annotated images and videos drawn by `OverlayRenderer`. It returns an `ExportReport`; the export jobs are planned and run by `workspace/`.

## Components

| Component | Description |
| --- | --- |
| [choices/](./choices/README.md) | What the export dialog lets the user choose: purpose, file format and crop settings. |
| [pictures/](./pictures/README.md) | The pictures an export writes: each exported picture, which of its findings are exported and its image file. |
| [preview/](./preview/README.md) | The label file an export would write for the shown picture, shown before exporting. |
| [writers/](./writers/README.md) | Writers of every export output: annotations, masks, crops, class folders, tables and annotated media. |
| [listed_findings.py](./listed_findings.py) | `ListedFindingsWriter` writes the findings a result table lists, in display order, as CSV text. |
| [options.py](./options.py) | `ExportOptions` holds how and where results are written. |
| [overlay_renderer.py](./overlay_renderer.py) | `OverlayRenderer` draws a result over its picture as tinted masks, labeled boxes or top classes. |
| [report.py](./report.py) | `ExportReport` describes what an export wrote. |
| [results.py](./results.py) | `ResultExporter` writes exported pictures in the chosen format with optional annotated images and videos. |
