# classification

## Overview

Classification with `open_vocabulary_classification`: `ClassificationModel` holds the settings of a classifier and `ClassificationRecognizer` runs it. `ClassifierPromptBuilder` and `ClassifierQueryLayout` turn the classes into the library prompt and back, and `ClassificationScorer` scores the kept logits of every text vector.

## Components

| Component | Description |
| --- | --- |
| [prompt_builder.py](./prompt_builder.py) | `ClassifierPromptBuilder` turns the phrases and visual examples of every class of a `LabeledPrompt` into the `open_vocabulary_classification` prompt, which fills them into the text templates. |
| [query_layout.py](./query_layout.py) | `ClassifierQueryLayout` holds the library prompt of a classifier with the prompt label of every query, and turns the library result of a picture into its `ClassifierLogits`, one per text vector. |
| [recognition_model.py](./recognition_model.py) | `ClassificationModel` holds the settings of an `open_vocabulary_classification` classifier (CLIP, SigLIP and variants) with its text templates and `PromptAggregation`; the steps on text vectors are a profile option, the steps on similarities score stored results again. |
| [recognizer.py](./recognizer.py) | `ClassificationRecognizer` wraps a loaded `open_vocabulary_classification` classifier, keeping the logits of the text vectors of every picture and scoring the classes from them. |
| [scorer.py](./scorer.py) | `ClassificationScorer` turns the logits of the text vectors of a classifier into class scores with the library's steps on similarities; it scores stored results again when those steps change. |
