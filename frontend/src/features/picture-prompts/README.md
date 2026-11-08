# picture-prompts

## Overview

Prompts drawn on a picture (boxes and points): drawing, choosing and removing them one at a time, and undoing and redoing those edits.

## Components

| Component | Responsibility |
|---|---|
| [DrawingHint.tsx](DrawingHint.tsx) | Line over the picture saying what the next click or drag does. |
| [ExemplarBar.tsx](ExemplarBar.tsx) | Bar next to the chosen exemplar box, to let it go or remove it. |
| [ObjectBar.tsx](ObjectBar.tsx) | Bar next to the object being marked, to finish or remove it. |
| [PromptList.tsx](PromptList.tsx) | List of the prompts on the picture, to choose or remove one even where drawings overlap. |
| [PromptOverlay.tsx](PromptOverlay.tsx) | Prompts drawn over the picture, with the targets that choose one by its pin or edge. |
| [PromptToolbar.tsx](PromptToolbar.tsx) | Toolbar choosing the drawing tool, class and polarity, with undo, redo, delete all and its shortcuts. |
| [promptItem.ts](promptItem.ts) | One drawing on the picture, an object or an exemplar box, as chosen or pointed at. |
| [usePicturePromptEditor.tsx](usePicturePromptEditor.tsx) | State and actions of the picture prompt editor. |
