# prompting

## Overview

Library-independent prompts of a recognition run. A `LabeledPrompt` lists `PromptClass`es whose queries are text phrases or visual examples, i.e. `ReferenceBox`es the user draws on reference images, collected by `ReferenceBoard`. `PromptSignature` captures what a prompt queries so that `PromptChange` can tell how classes changed since a result was recognized. The prompt builders of `models/` translate a `LabeledPrompt` into each library's prompt.

## Components

| Component | Description |
| --- | --- |
| [labeled_prompt.py](./labeled_prompt.py) | `LabeledPrompt` holds the classes to recognize with their queries and the signature of what they query. |
| [prompt_change.py](./prompt_change.py) | `PromptChange` describes how the classes have changed since a result was detected. |
| [prompt_class.py](./prompt_class.py) | `PromptClass` holds one class of a prompt with every query it is asked with. |
| [prompt_signature.py](./prompt_signature.py) | `PromptSignature` captures what a prompt queries class by class, independent of query order and cached embeddings. |
| [queried_class.py](./queried_class.py) | `QueriedClass` holds one class as a prompt queries it: its phrases and the reference boxes of its visual queries. |
| [query_kind.py](./query_kind.py) | `QueryKind` enumerates how a query tells the model what a class looks like. |
| [reference_board.py](./reference_board.py) | `ReferenceBoard` collects reference boxes drawn on reference images and turns them into the prompt of a run. |
| [reference_box.py](./reference_box.py) | `ReferenceBox` is a box drawn by the user around an example of a class, used as an image prompt. |
| [reference_image.py](./reference_image.py) | `ReferenceImage` identifies the pixels a reference box is drawn on, independent of the file location. |
| [visual_example.py](./visual_example.py) | `VisualExample` holds one visual query: the boxes drawn on one reference image for one class. |
