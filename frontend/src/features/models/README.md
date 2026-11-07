# models

## Overview

Model selection, model library and license consent.

## Components

| Component | Responsibility |
|---|---|
| [ModelBenchmarkChart.tsx](ModelBenchmarkChart.tsx) | Chart comparing model benchmarks. |
| [ModelLibraryDialog.tsx](ModelLibraryDialog.tsx) | Dialog browsing and choosing models. |
| [ModelPanel.tsx](ModelPanel.tsx) | Model settings of the setup pane. |
| [useLicenseGate.tsx](useLicenseGate.tsx) | Asks for license consent before using a licensed model. |
| [useModelSelection.ts](useModelSelection.ts) | Switches the model or its preset once every license it needs is accepted. |
