# cli

## Overview

Command-line interface of the `ovir-gui` command. `CommandLine` parses the media paths, host, port, browser and data-directory arguments into `LaunchOptions`, which `__main__.py` hands to the `WebLauncher` of `web/`. Without paths, the media of the last session are restored.

## Components

| Component | Description |
| --- | --- |
| [command_line.py](./command_line.py) | `CommandLine` defines and parses the arguments of the `ovir-gui` command. |
| [launch_options.py](./launch_options.py) | `LaunchOptions` holds what the command line asks to start. |

## Examples

```bash
ovir-gui ~/videos --port 8000
ovir-gui image.jpg --host 0.0.0.0 --no-browser --data-dir ./data
```
