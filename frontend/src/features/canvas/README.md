# canvas

## Overview

Picture viewer of the center pane.

## Components

| Component | Responsibility |
|---|---|
| [BoxShape.tsx](BoxShape.tsx) | Box drawn over a picture. |
| [CopyPictureButton.tsx](CopyPictureButton.tsx) | Copies the shown picture with its annotations. |
| [MaskShape.tsx](MaskShape.tsx) | Mask outline drawn over a picture. |
| [PlayerErrorBoundary.tsx](PlayerErrorBoundary.tsx) | Catches video player errors so the viewer can fall back. |
| [ResultViewer.tsx](ResultViewer.tsx) | Shows the current picture or video frame with its findings. |
| [ScorePanel.tsx](ScorePanel.tsx) | Class scores of a classified picture. |
| [ViewSettings.tsx](ViewSettings.tsx) | Display toggles of the viewer. |
| [ZoomableImage.tsx](ZoomableImage.tsx) | Zoomable and pannable image with an overlay. |
| [viewerDrawing.ts](viewerDrawing.ts) | Interface for drawing prompts on the viewer. |
