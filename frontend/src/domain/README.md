# domain

## Overview

Pure TypeScript logic without React: computations, formatting and data models used by the UI.

## Components

| Component | Responsibility |
|---|---|
| [aggregationDiagram.ts](aggregationDiagram.ts) | Layout of the diagram showing how classification scores are aggregated. |
| [aggregationRows.ts](aggregationRows.ts) | Conversion between aggregation steps and the two-row editor model. |
| [annotatedSnapshot.ts](annotatedSnapshot.ts) | Renders the shown picture with its annotations to an image for copying. |
| [classPairs.ts](classPairs.ts) | Ranks class pairs from a class matrix. |
| [columnFacets.ts](columnFacets.ts) | Value and range facets of result table columns, used by filters. |
| [columnWidths.ts](columnWidths.ts) | Fits result table column widths to their content. |
| [confidenceOverview.ts](confidenceOverview.ts) | Score distributions per class and prompt for the review panel. |
| [displayOptions.ts](displayOptions.ts) | Display options for findings (labels, scores, findings below the minimum score). |
| [droppedFiles.ts](droppedFiles.ts) | Picks media and image files from dropped or chosen files. |
| [embedBridge.ts](embedBridge.ts) | Message protocol between an embedding page and the app. |
| [findingInterpolator.ts](findingInterpolator.ts) | Moves video findings between sampled frames so they follow moving objects. |
| [findingPainter.ts](findingPainter.ts) | Draws findings of a video frame on a canvas. |
| [frameResultIndex.ts](frameResultIndex.ts) | Index of video frame results by frame number. |
| [frameView.ts](frameView.ts) | View model of a frame's findings and class colors. |
| [galleryGroups.ts](galleryGroups.ts) | Grouping and sorting of classification gallery pictures. |
| [galleryNavigation.ts](galleryNavigation.ts) | Keyboard navigation over tiled gallery groups. |
| [livePace.ts](livePace.ts) | Estimates recognition speed and the playback rate that stays just behind it. |
| [maskOutlineCache.ts](maskOutlineCache.ts) | Cache of mask outlines decoded from the server. |
| [mediaGroups.ts](mediaGroups.ts) | Grouping and ordering of media in the media list. |
| [mediaSelection.ts](mediaSelection.ts) | Media a run applies to, from the checked and current media. |
| [modelFamily.ts](modelFamily.ts) | Model family of a model name. |
| [numbers.ts](numbers.ts) | Clamping and byte size formatting. |
| [overlapOverview.ts](overlapOverview.ts) | Overlap statistics between findings for the review panel. |
| [pictureGallery.ts](pictureGallery.ts) | Tiles and sorting of the picture gallery. |
| [playbackPosition.ts](playbackPosition.ts) | Playback position of a video in frames and seconds. |
| [promptInputs.ts](promptInputs.ts) | Prompt inputs a model accepts. |
| [records.ts](records.ts) | Immutable record update helpers. |
| [resultColumns.ts](resultColumns.ts) | Result table column keys and kinds. |
| [resultTable.ts](resultTable.ts) | Result table rows, columns and scopes. |
| [reviewFilter.ts](reviewFilter.ts) | Thresholds and filters applied when reviewing findings. |
| [reviewModes.ts](reviewModes.ts) | Review modes and histogram highlights. |
| [scoreBars.ts](scoreBars.ts) | Geometry of score bars in the result table. |
| [scoreHistogram.ts](scoreHistogram.ts) | Score histograms and value ranges. |
| [sets.ts](sets.ts) | Immutable set membership helpers. |
| [statisticsFormat.ts](statisticsFormat.ts) | Number formatting for statistics. |
| [taskViews.ts](taskViews.ts) | Per-task view definitions (tabs, display toggles, columns). |
| [textTemplate.ts](textTemplate.ts) | Prompt template text and its words. |
| [videoEvents.ts](videoEvents.ts) | Class appearance events along a video. |
| [videoTime.ts](videoTime.ts) | Video time formatting and timeline ticks. |
| [viewportPlacement.ts](viewportPlacement.ts) | Places popups inside the viewport. |
