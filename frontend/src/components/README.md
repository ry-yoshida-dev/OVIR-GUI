# components

## Overview

Generic UI primitives shared by features. They know nothing about recognition tasks.

## Components

| Component | Responsibility |
|---|---|
| [Dialog.tsx](Dialog.tsx) | Modal dialog frame. |
| [DialogHost.tsx](DialogHost.tsx) | Host for confirmation and message dialogs opened from anywhere. |
| [Glyphs.tsx](Glyphs.tsx) | Inline SVG icons. |
| [HistogramBars.tsx](HistogramBars.tsx) | Bars of a histogram, used by score charts and range filters. |
| [InfoTip.tsx](InfoTip.tsx) | Info icon that shows an explanation on hover or focus. |
| [Menu.tsx](Menu.tsx) | Popup menu and the hook that opens it. |
| [MixedCheckbox.tsx](MixedCheckbox.tsx) | Checkbox with an indeterminate state for partially checked groups. |
| [NumberField.tsx](NumberField.tsx) | Numeric input that commits validated values. |
| [PopoverButton.tsx](PopoverButton.tsx) | Button that opens a popover. |
| [Section.tsx](Section.tsx) | Collapsible titled section. |
| [Splitter.tsx](Splitter.tsx) | Draggable divider between panes. |
| [StepperField.tsx](StepperField.tsx) | Numeric field with step buttons. |
| [TeX.tsx](TeX.tsx) | Renders a TeX formula with KaTeX; loaded lazily. |
| [TooltipLayer.tsx](TooltipLayer.tsx) | Single tooltip layer serving every `title`-like hint. |
