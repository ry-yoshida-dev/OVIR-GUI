# shell

## Overview

App frame: task tabs, the three panes, status bar, notices and app dialogs.

## Components

| Component | Responsibility |
|---|---|
| [AppDialogs.tsx](AppDialogs.tsx) | Dialogs opened from the app frame. |
| [AppErrorBoundary.tsx](AppErrorBoundary.tsx) | Shows an error screen when rendering fails. |
| [BinderShape.tsx](BinderShape.tsx) | Binder-shaped background of the task tabs. |
| [BinderTabs.tsx](BinderTabs.tsx) | Task tabs. |
| [CanvasPane.tsx](CanvasPane.tsx) | Center pane. |
| [CenterModeToggle.tsx](CenterModeToggle.tsx) | Toggle between the gallery and the image view. |
| [ConnectionIndicator.tsx](ConnectionIndicator.tsx) | Server connection state. |
| [DropOverlay.tsx](DropOverlay.tsx) | Overlay shown while files are dragged over the app. |
| [Notices.tsx](Notices.tsx) | Notices from the server. |
| [PaneHeader.tsx](PaneHeader.tsx) | Header of a pane. |
| [ResultsPane.tsx](ResultsPane.tsx) | Right pane with results. |
| [SetupPane.tsx](SetupPane.tsx) | Left pane with media, classes, model and run settings. |
| [StatusBar.tsx](StatusBar.tsx) | Status bar. |
| [TaskGlyph.tsx](TaskGlyph.tsx) | Icon of a recognition task. |
| [binderGeometry.ts](binderGeometry.ts) | Geometry of the task tabs. |
| [useGlobalShortcuts.ts](useGlobalShortcuts.ts) | App-wide keyboard shortcuts. |
