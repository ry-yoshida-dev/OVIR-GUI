# request_bodies

## Overview

Request bodies of the JSON API, validated by FastAPI before a route handler of the `web` package runs. Each model describes one kind of user input, such as a picture to show, classes typed by the user, model settings or an export chosen in the export dialog. Reference models (`FindingReference`, `PhraseReference`, `ImagePromptReference`, `PictureFindings`) identify items inside larger bodies.

## Components

| Component | Description |
| --- | --- |
| [acceptance.py](./acceptance.py) | `AcceptanceBody` lists findings of the shown results to keep or reject. |
| [aggregation_step.py](./aggregation_step.py) | `AggregationStepBody` is one step merging the prompts or templates of a classifier class: unit, timing and method. |
| [approval.py](./approval.py) | `ApprovalBody` is a request that may need the user's approval to leave out classes. |
| [box_corners.py](./box_corners.py) | `BoxCorners` is a box sent by the browser as `[left, top, right, bottom]`, checked to hold four values. |
| [class_row.py](./class_row.py) | `ClassRowBody` carries a class, or phrases of a class, typed by the user. |
| [exemplar.py](./exemplar.py) | `ExemplarBody` carries an exemplar box drawn on a picture. |
| [exemplar_removal.py](./exemplar_removal.py) | `ExemplarRemovalBody` names an exemplar box to remove from a picture. |
| [export.py](./export.py) | `ExportBody` describes the export chosen in the export dialog. |
| [export_preview.py](./export_preview.py) | `ExportPreviewBody` describes the export chosen in the export dialog, whose label file is previewed. |
| [finding_reference.py](./finding_reference.py) | `FindingReference` identifies one finding of the shown results. |
| [image_prompt_reference.py](./image_prompt_reference.py) | `ImagePromptReference` identifies one reference image of a class. |
| [inference.py](./inference.py) | `InferenceBody` chooses which pictures are inferred and whether automatically. |
| [label_mode.py](./label_mode.py) | `LabelModeBody` sets the label mode of classifications: single- or multi-label. |
| [license.py](./license.py) | `LicenseBody` names the licensed module whose license the user accepted. |
| [mark.py](./mark.py) | `MarkBody` carries the points and box marking one object on a picture. |
| [mark_removal.py](./mark_removal.py) | `MarkRemovalBody` names an object to unmark on one picture or on its whole file. |
| [model_selection.py](./model_selection.py) | `ModelSelectionBody` carries the preset and overrides chosen in the model settings. |
| [move_phrase.py](./move_phrase.py) | `MovePhraseBody` moves a phrase to another position or class. |
| [move_reference.py](./move_reference.py) | `MoveReferenceBody` moves a reference image to another class. |
| [name.py](./name.py) | `NameBody` carries a name. |
| [path.py](./path.py) | `PathBody` names a file or directory on the server. |
| [paths.py](./paths.py) | `PathsBody` names files or directories on the server. |
| [phrase_reference.py](./phrase_reference.py) | `PhraseReference` identifies one phrase of a class. |
| [picture.py](./picture.py) | `PictureBody` names one image or video frame. |
| [picture_findings.py](./picture_findings.py) | `PictureFindings` lists the findings of one picture. |
| [preset.py](./preset.py) | `PresetBody` chooses a preset with its own values. |
| [profile.py](./profile.py) | `ProfileBody` names a stored model profile, or none. |
| [profiles.py](./profiles.py) | `ProfilesBody` names stored model profiles removed at once. |
| [reference_boxes.py](./reference_boxes.py) | `ReferenceBoxesBody` carries the boxes drawn on a reference draft for one class. |
| [remove_classes.py](./remove_classes.py) | `RemoveClassesBody` lists classes, phrases and reference images removed at once. |
| [run_all.py](./run_all.py) | `RunAllBody` runs every picture lacking a result, the shown video optionally from a given frame onward. |
| [sampling.py](./sampling.py) | `SamplingBody` sets the sampling of video frames. |
| [show.py](./show.py) | `ShowBody` names the picture to show and whether its video plays. |
| [suppression.py](./suppression.py) | `SuppressionBody` sets the review suppression of overlapping boxes for the current task. |
| [table.py](./table.py) | `TableBody` lists the findings of the result table, in display order. |
| [task.py](./task.py) | `TaskBody` names the task to switch to. |
| [text.py](./text.py) | `TextBody` carries a text. |
| [text_templates.py](./text_templates.py) | `TextTemplatesBody` carries the text templates saved for reuse by classifiers. |
| [thresholds.py](./thresholds.py) | `ThresholdsBody` sets the minimum confidence of the classes and phrases for the current task. |
| [weights.py](./weights.py) | `WeightsBody` names the downloaded weights of a preset to delete. |
