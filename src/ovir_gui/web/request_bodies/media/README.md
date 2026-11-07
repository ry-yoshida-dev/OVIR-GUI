# media

## Overview

Request bodies of `MediaRoutes`: opening and showing media, sampling of video frames and background inference.

## Components

| Component | Description |
| --- | --- |
| [inference.py](./inference.py) | `InferenceBody` chooses which pictures are inferred and whether automatically. |
| [paths.py](./paths.py) | `PathsBody` names files or directories on the server. |
| [sampling.py](./sampling.py) | `SamplingBody` sets the sampling of video frames. |
| [show.py](./show.py) | `ShowBody` names the picture to show and whether its video plays. |
