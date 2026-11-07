# export

## Overview

Writing reviewed results to disk. `ResultExporter` takes the `ExportItem`s selected by `ExportSelection`, writes them in the chosen `ExportFormat` (CSV/JSON tables, box formats of `object_detection_format`, mask formats of `segmentation_format`, classification formats of `classification_format`, mask images, class folders, cropped objects) and optionally saves annotated images and videos drawn by `OverlayRenderer`. It returns an `ExportReport`; the export jobs are planned and run by `workspace/`.

## Components

| Component | Description |
| --- | --- |
| [writers/](./writers/README.md) | Writers of every export output: annotations, masks, crops, class folders, tables and annotated media. |
| [crop_image_format.py](./crop_image_format.py) | `CropImageFormat` enumerates the image formats cropped objects are saved in (JPEG, PNG). |
| [crop_options.py](./crop_options.py) | `CropOptions` holds the image format and the margin (percent of the box) of cropped objects and computes the cropped pixels. |
| [format.py](./format.py) | `ExportFormat` enumerates the file formats results are exported to. |
| [item.py](./item.py) | `ExportItem` describes one picture as it is exported. |
| [label_preview.py](./label_preview.py) | `LabelPreview` holds the text of one label file an export writes, shown before exporting. |
| [label_previewer.py](./label_previewer.py) | `LabelPreviewer` writes an export into a temporary directory, for the shown picture only with formats writing a file per picture, and reads back its label file. |
| [options.py](./options.py) | `ExportOptions` holds how and where results are written. |
| [overlay_renderer.py](./overlay_renderer.py) | `OverlayRenderer` draws a result over its picture as tinted masks, labeled boxes or top classes. |
| [picture_files.py](./picture_files.py) | `PictureFiles` provides the image file of every exported picture, writing a JPEG for video frames. |
| [purpose.py](./purpose.py) | `ExportPurpose` enumerates what an export gives the user (annotations, crops, class folders), the first choice of the export dialog. |
| [report.py](./report.py) | `ExportReport` describes what an export wrote. |
| [results.py](./results.py) | `ResultExporter` writes exported pictures in the chosen format with optional annotated images and videos. |
| [selection.py](./selection.py) | `ExportSelection` holds which stored findings of a picture are exported. |
