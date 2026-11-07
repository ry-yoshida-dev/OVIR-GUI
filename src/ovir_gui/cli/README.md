# cli

## Overview

Command-line interface of the `ovir-gui` command, parsed into the `LaunchOptions` that `__main__.py` hands to the web launcher. `ovir-gui --help` lists every option.

## Components

| Component | Description |
| --- | --- |
| [command_line.py](./command_line.py) | `CommandLine` defines and parses the arguments of the `ovir-gui` command. |
| [launch_options.py](./launch_options.py) | `LaunchOptions` holds what the command line asks to start. |

## Examples

```bash
ovir-gui ~/videos --port 8000
ovir-gui image.jpg --host 0.0.0.0 --no-browser --data-dir ./data
ovir-gui --download-ffmpeg
OVIR_GUI_TOKEN=a-long-random-secret ovir-gui --no-browser --embed-origin http://localhost:3000
```
