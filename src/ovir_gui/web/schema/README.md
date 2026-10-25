# schema

## Overview

Request bodies of the JSON API, validated by FastAPI before a route handler of the `web` package runs. Each model describes one kind of user input, such as a picture to show, classes typed by the user, model settings or an export chosen in the export dialog. Reference models (`FindingReference`, `PhraseReference`, `ImagePromptReference`, `PictureFindings`) identify items inside larger bodies.

## Components

| Component | Description |
| --- | --- |
| [aggregation_step_body.py](./aggregation_step_body.py) | `AggregationStepBody` is one step merging the prompts or templates of a classifier class: unit, timing and method. |
| [acceptance_body.py](./acceptance_body.py) | `AcceptanceBody` lists findings of the shown results to keep or reject. |
| [approval_body.py](./approval_body.py) | `ApprovalBody` is a request that may need the user's approval to leave out classes. |
| [class_row_body.py](./class_row_body.py) | `ClassRowBody` carries a class, or phrases of a class, typed by the user. |
| [exemplar_body.py](./exemplar_body.py) | `ExemplarBody` carries an exemplar box drawn on a picture. |
| [exemplar_removal_body.py](./exemplar_removal_body.py) | `ExemplarRemovalBody` names an exemplar box to remove from a picture. |
| [export_body.py](./export_body.py) | `ExportBody` describes the export chosen in the export dialog. |
| [export_preview_body.py](./export_preview_body.py) | `ExportPreviewBody` describes the export chosen in the export dialog, whose label file is previewed. |
| [finding_reference.py](./finding_reference.py) | `FindingReference` identifies one finding of the shown results. |
| [image_prompt_reference.py](./image_prompt_reference.py) | `ImagePromptReference` identifies one reference image of a class. |
| [inference_body.py](./inference_body.py) | `InferenceBody` chooses which pictures are inferred and whether automatically. |
| [label_mode_body.py](./label_mode_body.py) | `LabelModeBody` sets the label mode of classifications: single- or multi-label. |
| [license_body.py](./license_body.py) | `LicenseBody` names the licensed module whose license the user accepted. |
| [mark_body.py](./mark_body.py) | `MarkBody` carries the points and box marking one object on a picture. |
| [mark_removal_body.py](./mark_removal_body.py) | `MarkRemovalBody` names an object to unmark on one picture or on its whole file. |
| [model_selection_body.py](./model_selection_body.py) | `ModelSelectionBody` carries the preset and overrides chosen in the model settings. |
| [move_phrase_body.py](./move_phrase_body.py) | `MovePhraseBody` moves a phrase to another position or class. |
| [move_reference_body.py](./move_reference_body.py) | `MoveReferenceBody` moves a reference image to another class. |
| [name_body.py](./name_body.py) | `NameBody` carries a name. |
| [path_body.py](./path_body.py) | `PathBody` names a file or directory on the server. |
| [paths_body.py](./paths_body.py) | `PathsBody` names files or directories on the server. |
| [phrase_reference.py](./phrase_reference.py) | `PhraseReference` identifies one phrase of a class. |
| [picture_body.py](./picture_body.py) | `PictureBody` names one image or video frame. |
| [picture_findings.py](./picture_findings.py) | `PictureFindings` lists the findings of one picture. |
| [preset_body.py](./preset_body.py) | `PresetBody` chooses a preset with its own values. |
| [profile_body.py](./profile_body.py) | `ProfileBody` names a stored model profile, or none. |
| [profiles_body.py](./profiles_body.py) | `ProfilesBody` names stored model profiles removed at once. |
| [reference_boxes_body.py](./reference_boxes_body.py) | `ReferenceBoxesBody` carries the boxes drawn on a reference draft for one class. |
| [remove_classes_body.py](./remove_classes_body.py) | `RemoveClassesBody` lists classes, phrases and reference images removed at once. |
| [run_all_body.py](./run_all_body.py) | `RunAllBody` runs every picture lacking a result, the shown video optionally from a given frame onward. |
| [sampling_body.py](./sampling_body.py) | `SamplingBody` sets the sampling of video frames. |
| [show_body.py](./show_body.py) | `ShowBody` names the picture to show and whether its video plays. |
| [table_body.py](./table_body.py) | `TableBody` lists the findings of the result table, in display order. |
| [task_body.py](./task_body.py) | `TaskBody` names the task to switch to. |
| [suppression_body.py](./suppression_body.py) | `SuppressionBody` sets the review suppression of overlapping boxes for the current task. |
| [text_body.py](./text_body.py) | `TextBody` carries a text. |
| [text_templates_body.py](./text_templates_body.py) | `TextTemplatesBody` carries the text templates saved for reuse by classifiers. |
| [thresholds_body.py](./thresholds_body.py) | `ThresholdsBody` sets the minimum confidence of the classes and phrases for the current task. |
| [weights_body.py](./weights_body.py) | `WeightsBody` names the downloaded weights of a preset to delete. |
