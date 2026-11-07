# embed

## Overview

Host page that opens the interface in a movable window inside an iframe and controls it with `postMessage`.

## Components

| Component | Responsibility |
|---|---|
| [index.html](index.html) | Embedding host page. |

## Examples

Serve this directory on `http://localhost:3000` and start the server with the token the page's address field uses:

```bash
python -m http.server 3000 --directory examples/embed
OVIR_GUI_TOKEN=change-me-to-a-long-secret ovir-gui --no-browser --embed-origin http://localhost:3000
```
