# choices

## Overview

What the export dialog lets the user choose: purpose, file format and crop settings, combined by `ExportOptions`.

## Components

| Component | Description |
| --- | --- |
| [crop.py](./crop.py) | `CropOptions` holds the image format and the margin (percent of the box) of cropped objects and computes the cropped pixels. |
| [crop_image_format.py](./crop_image_format.py) | `CropImageFormat` enumerates the image formats cropped objects are saved in (JPEG, PNG). |
| [format.py](./format.py) | `ExportFormat` enumerates the file formats results are exported to. |
| [purpose.py](./purpose.py) | `ExportPurpose` enumerates what an export gives the user (annotations, crops, class folders), the first choice of the export dialog. |
