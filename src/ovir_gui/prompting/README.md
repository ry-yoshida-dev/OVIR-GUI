# prompting

## Overview

Library-independent prompts of a recognition run. A `LabeledPrompt` lists `PromptClass`es whose queries are text phrases or visual examples, i.e. `ReferenceBox`es the user draws on reference images, collected by `ReferenceBoard` (`reference/`). It also carries what is drawn on the recognized pictures themselves, collected by `PicturePromptBoard` (`picture_prompts/`): `ExemplarBox`es showing or excluding a class there (SAM 3) and `ObjectMark`s of points and a box marking single objects (promptable segmenters and video trackers). `PromptMode` tells whether a model takes classes, marks or nothing. `PromptSignature` captures what a prompt queries on each picture, drawings included, so that `PromptChange` can tell how classes changed since a result was recognized (`staleness/`). The prompt builders of `inference/` translate a `LabeledPrompt` into each library's prompt.

## Components

| Component | Description |
| --- | --- |
| [picture_prompts/](./picture_prompts/README.md) | Exemplar boxes and object marks drawn on the recognized pictures, as an editable board and as a detached snapshot. |
| [reference/](./reference/README.md) | Boxes the user draws on reference images and the visual queries they form. |
| [staleness/](./staleness/README.md) | What a prompt queried on each picture, so a stored result can tell whether and how its classes changed since. |
| [labeled_prompt.py](./labeled_prompt.py) | `LabeledPrompt` holds the classes to recognize with their queries, the drawings of the pictures and the signature of each picture. |
| [mode.py](./mode.py) | `PromptMode` enumerates whether a model takes classes, object marks or nothing. |
| [prompt_class.py](./prompt_class.py) | `PromptClass` holds one class of a prompt with every query it is asked with. |
| [query_kind.py](./query_kind.py) | `QueryKind` enumerates how a query tells the model what a class looks like. |
