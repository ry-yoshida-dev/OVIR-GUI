# frontend

## Overview

React + TypeScript user interface built with Vite. `npm run build` type-checks and writes the bundle into
`src/ovir_gui/web/static`, which the Python server serves; `npm run dev` proxies `/api` to the server.

## Components

| Component | Responsibility |
|---|---|
| [src/](src/README.md) | Application source. |
| [lint/](lint/README.md) | ESLint toolchain, kept as its own package. |
| [index.html](index.html) | HTML entry of the app. |
| [package.json](package.json) | Dependencies and the `dev`, `build`, `typecheck`, `lint` and `test` scripts. |
| [tsconfig.json](tsconfig.json) | TypeScript settings, including the `@/` alias for `src/`. |
| [vite.config.ts](vite.config.ts) | Vite and Vitest settings: `@/` alias, build output, test files and `/api` proxy. |

## Examples

```bash
npm install
npm run dev        # http://localhost:5173, proxying /api to OVIR_GUI_BACKEND (default http://127.0.0.1:8000)
npm run typecheck
npm run lint
npm test           # unit tests (*.test.ts next to the source)
npm run build
```
