# classes

## Overview

Classes of each task: `ClassWorkbench` edits them by class id with their phrases, reference images and drawings, keeping the `TaskClasses` of every task, and `PromptAssembler` builds the prompt of a model from them as a `PromptPreparation`.

## Components

| Component | Description |
| --- | --- |
| [prompt_assembler.py](./prompt_assembler.py) | `PromptAssembler` builds the prompt of a model from the classes, reference images and drawings, asking approval to skip classes it cannot query. |
| [prompt_preparation.py](./prompt_preparation.py) | `PromptPreparation` holds the prompt built from the classes, or why none could be built. |
| [task.py](./task.py) | `TaskClasses` holds the classes, reference images, drawings and class set of one task. |
| [workbench.py](./workbench.py) | `ClassWorkbench` edits the classes of the current task with their phrases and reference images by class id, keeps the exemplar boxes and object marks drawn for them on pictures, and tracks their class set; every task keeps its own. |
