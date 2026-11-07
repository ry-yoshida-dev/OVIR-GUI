# lint

## Overview

ESLint toolchain for the frontend, installed by the frontend's `postinstall`. It is a separate package because
typescript-eslint requires the TypeScript 6 API while the build uses TypeScript 7.

## Components

| Component | Responsibility |
|---|---|
| [eslint.config.js](eslint.config.js) | Lint rules for `src/` and `vite.config.ts`. |
| [package.json](package.json) | ESLint and its plugins. |
