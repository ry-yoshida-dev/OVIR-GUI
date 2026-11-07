# src

## Overview

Application source. Imports across directories use the `@/` alias; files in the same directory import each other
relatively. Lower layers never import higher ones: `domain/` and `api/` know nothing about React, `behaviors/` and
`components/` know nothing about features, and `features/` are composed by `App.tsx`.

## Components

| Component | Responsibility |
|---|---|
| [main.tsx](main.tsx) | Entry point mounting the app with its error boundary, dialog host and tooltip layer. |
| [App.tsx](App.tsx) | Root component composing the features with the app-wide state. |
| [api/](api/README.md) | Server client and the types matching its API. |
| [domain/](domain/README.md) | Pure TypeScript logic without React. |
| [state/](state/README.md) | App-wide state hooks. |
| [behaviors/](behaviors/README.md) | Reusable logic built on React hooks. |
| [components/](components/README.md) | Generic UI primitives. |
| [features/](features/README.md) | UI grouped by feature. |
| [theme/](theme/README.md) | Global styles and theme tokens. |
