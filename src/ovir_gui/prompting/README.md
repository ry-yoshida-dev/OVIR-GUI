# prompting

## Overview

Library-independent prompts of a recognition run. A `LabeledPrompt` lists `PromptClass`es whose queries are text phrases or visual examples, i.e. `ReferenceBox`es the user draws on reference images, collected by `ReferenceBoard`. It also carries what is drawn on the recognized pictures themselves, collected by `PicturePromptBoard`: `ExemplarBox`es showing or excluding a class there (SAM 3) and `ObjectMark`s of points and a box marking single objects (promptable segmenters and video trackers). `PromptMode` tells whether a model takes classes, marks or nothing. `PromptSignature` captures what a prompt queries on each picture, drawings included, so that `PromptChange` can tell how classes changed since a result was recognized. The prompt builders of `models/` translate a `LabeledPrompt` into each library's prompt.

## Components

| Component | Description |
| --- | --- |
| [exemplar_box.py](./exemplar_box.py) | `ExemplarBox` is a box drawn on a recognized picture showing what a class is, or is not, there. |
| [frame_prompt.py](./frame_prompt.py) | `FramePrompt` holds the exemplar boxes and object marks drawn on one picture or one video. |
| [labeled_prompt.py](./labeled_prompt.py) | `LabeledPrompt` holds the classes to recognize with their queries, the drawings of the pictures and the signature of each picture. |
| [object_mark.py](./object_mark.py) | `ObjectMark` holds the points and box marking one object of a class on one picture. |
| [picture_prompt_board.py](./picture_prompt_board.py) | `PicturePromptBoard` collects the exemplar boxes and object marks drawn on the pictures, following class renames. |
| [picture_prompts.py](./picture_prompts.py) | `PicturePrompts` is a detached copy of every drawing, looked up per picture or per media file. |
| [prompt_change.py](./prompt_change.py) | `PromptChange` describes how the classes have changed since a result was detected. |
| [prompt_class.py](./prompt_class.py) | `PromptClass` holds one class of a prompt with every query it is asked with. |
| [prompt_mode.py](./prompt_mode.py) | `PromptMode` enumerates whether a model takes classes, object marks or nothing. |
| [prompt_signature.py](./prompt_signature.py) | `PromptSignature` captures what a prompt queries class by class, independent of query order and cached embeddings. |
| [queried_class.py](./queried_class.py) | `QueriedClass` holds one class as a prompt queries it on a picture: phrases, reference boxes, exemplar boxes and object marks. |
| [query_kind.py](./query_kind.py) | `QueryKind` enumerates how a query tells the model what a class looks like. |
| [reference_board.py](./reference_board.py) | `ReferenceBoard` collects reference boxes drawn on reference images and turns them into the queried classes of a run. |
| [reference_box.py](./reference_box.py) | `ReferenceBox` is a box drawn by the user around an example of a class, used as an image prompt. |
| [reference_image.py](./reference_image.py) | `ReferenceImage` identifies the pixels a reference box is drawn on, independent of the file location. |
| [visual_example.py](./visual_example.py) | `VisualExample` holds one visual query: the boxes drawn on one reference image for one class. |
