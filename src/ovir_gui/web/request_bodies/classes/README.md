# classes

## Overview

Request bodies of `ClassRoutes`: classes, phrases, reference images and class sets. `PhraseReference` and `ImagePromptReference` identify the items removed by `RemoveClassesBody`.

## Components

| Component | Description |
| --- | --- |
| [image_prompt_reference.py](./image_prompt_reference.py) | `ImagePromptReference` identifies one reference image of a class. |
| [move_phrase.py](./move_phrase.py) | `MovePhraseBody` moves a phrase to another position or class. |
| [move_reference.py](./move_reference.py) | `MoveReferenceBody` moves a reference image to another class. |
| [name.py](./name.py) | `NameBody` carries a name. |
| [phrase_reference.py](./phrase_reference.py) | `PhraseReference` identifies one phrase of a class. |
| [reference_boxes.py](./reference_boxes.py) | `ReferenceBoxesBody` carries the boxes drawn on a reference draft for one class. |
| [removal.py](./removal.py) | `RemoveClassesBody` lists classes, phrases and reference images removed at once. |
| [row.py](./row.py) | `ClassRowBody` carries a class, or phrases of a class, typed by the user. |
| [text.py](./text.py) | `TextBody` carries a text. |
