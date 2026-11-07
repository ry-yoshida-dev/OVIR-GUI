# writers

## Overview

One writer per kind of output an export produces: annotation files in box, mask and classification formats, mask images, cropped objects, class folders, tables and annotated images and videos. `ResultExporter` picks the writers for the chosen format.

## Components

| Component | Description |
| --- | --- |
| [annotated_image.py](./annotated_image.py) | `AnnotatedImageWriter` saves every exported picture with its findings drawn as JPEG in `annotated/`, never over a source. |
| [annotated_video.py](./annotated_video.py) | `AnnotatedVideoWriter` saves every exported video with its findings drawn on every frame as `annotated/<stem>_annotated.mp4`. |
| [box_annotation.py](./box_annotation.py) | `BoxAnnotationWriter` writes the boxes of exported instances in a box format of `object_detection_format`. |
| [class_folder.py](./class_folder.py) | `ClassFolderWriter` copies every classified picture into the folder of each of its classes, `_unlabeled` without one. |
| [cropped_object.py](./cropped_object.py) | `CroppedObjectWriter` saves the box of every exported instance, widened by the margin, as its own image in `crops/<class>/` and lists the crops with their sources in `crops.csv`. |
| [label_annotation.py](./label_annotation.py) | `LabelAnnotationWriter` writes the classes of exported classifications in a format of `classification_format` (class-column or label-list CSV, Hugging Face imagefolder, Pascal VOC image sets, Open Images), exported classes present and the other scored classes absent. |
| [mask_annotation.py](./mask_annotation.py) | `MaskAnnotationWriter` writes the masks of exported instances in a mask format of `segmentation_format` (COCO, YOLO, LabelMe), one picture at a time. |
| [mask_image.py](./mask_image.py) | `MaskImageWriter` writes label maps of exported instances as PNG images. |
| [table.py](./table.py) | `TableExportWriter` writes exported results as one CSV table or one JSON document. |
