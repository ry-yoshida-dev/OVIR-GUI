# preview

## Overview

The label file an export would write for the shown picture, shown before exporting.

## Components

| Component | Description |
| --- | --- |
| [label.py](./label.py) | `LabelPreview` holds the text of one label file an export writes, shown before exporting. |
| [previewer.py](./previewer.py) | `LabelPreviewer` writes an export into a temporary directory, for the shown picture only with formats writing a file per picture, and reads back its label file. |
