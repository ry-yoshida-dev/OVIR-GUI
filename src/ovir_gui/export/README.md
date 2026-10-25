# export

## Overview

Writing reviewed results to disk. `ResultExporter` takes the `ExportItem`s selected by `ExportScope` and `ExportSelection`, writes them in the chosen `ExportFormat` (CSV/JSON tables, box formats of `object_detection_format`, mask formats of `segmentation_format`, mask images, class folders, cropped objects) and optionally saves annotated images and videos drawn by `OverlayRenderer`. It returns an `ExportReport`; the export jobs are planned and run by `workspace/`.

## Components

| Component | Description |
| --- | --- |
| [annotated_image_writer.py](./annotated_image_writer.py) | `AnnotatedImageWriter` saves every exported picture with its findings drawn as JPEG in `annotated/`, never over a source. |
| [annotated_video_writer.py](./annotated_video_writer.py) | `AnnotatedVideoWriter` saves every exported video with its findings drawn on every frame as `annotated/<stem>_annotated.mp4`. |
| [box_annotation_writer.py](./box_annotation_writer.py) | `BoxAnnotationWriter` writes the boxes of exported instances in a box format of `object_detection_format`. |
| [class_folder_writer.py](./class_folder_writer.py) | `ClassFolderWriter` copies every classified picture into the folder of each of its classes, `_unlabeled` without one. |
| [crop_image_format.py](./crop_image_format.py) | `CropImageFormat` enumerates the image formats cropped objects are saved in (JPEG, PNG). |
| [crop_options.py](./crop_options.py) | `CropOptions` holds the image format and the margin (percent of the box) of cropped objects and computes the cropped pixels. |
| [cropped_object_writer.py](./cropped_object_writer.py) | `CroppedObjectWriter` saves the box of every exported instance, widened by the margin, as its own image in `crops/<class>/` and lists the crops with their sources in `crops.csv`. |
| [export_format.py](./export_format.py) | `ExportFormat` enumerates the file formats results are exported to. |
| [export_item.py](./export_item.py) | `ExportItem` describes one picture as it is exported. |
| [export_options.py](./export_options.py) | `ExportOptions` holds how and where results are written. |
| [export_purpose.py](./export_purpose.py) | `ExportPurpose` enumerates what an export gives the user (annotations, crops, class folders), the first choice of the export dialog. |
| [export_report.py](./export_report.py) | `ExportReport` describes what an export wrote. |
| [export_scope.py](./export_scope.py) | `ExportScope` enumerates which kept findings are exported. |
| [export_selection.py](./export_selection.py) | `ExportSelection` holds which stored findings of a picture are exported. |
| [label_preview.py](./label_preview.py) | `LabelPreview` holds the text of one label file an export writes, shown before exporting. |
| [label_previewer.py](./label_previewer.py) | `LabelPreviewer` writes an export into a temporary directory, for the shown picture only with formats writing a file per picture, and reads back its label file. |
| [listed_findings_writer.py](./listed_findings_writer.py) | `ListedFindingsWriter` writes the findings a result table lists, in display order, as CSV text. |
| [mask_annotation_writer.py](./mask_annotation_writer.py) | `MaskAnnotationWriter` writes the masks of exported instances in a mask format of `segmentation_format` (COCO, YOLO, LabelMe), one picture at a time. |
| [mask_image_writer.py](./mask_image_writer.py) | `MaskImageWriter` writes label maps of exported instances as PNG images. |
| [overlay_renderer.py](./overlay_renderer.py) | `OverlayRenderer` draws a result over its picture as tinted masks, labeled boxes or top classes. |
| [picture_files.py](./picture_files.py) | `PictureFiles` provides the image file of every exported picture, writing a JPEG for video frames. |
| [result_exporter.py](./result_exporter.py) | `ResultExporter` writes exported pictures in the chosen format with optional annotated images and videos. |
| [table_export_writer.py](./table_export_writer.py) | `TableExportWriter` writes exported results as one CSV table or one JSON document. |
