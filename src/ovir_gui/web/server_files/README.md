# server_files

## Overview

Access to files on the server machine for the browser: `DirectoryBrowser` lists folders to choose what to open, and `TemporaryUpload` keeps a file uploaded with a request while it is used.

## Components

| Component | Description |
| --- | --- |
| [directory_browser.py](./directory_browser.py) | `DirectoryBrowser` lists folders and image files on the server so the browser can choose what to open. |
| [temporary_upload.py](./temporary_upload.py) | `TemporaryUpload` writes a file uploaded with a request to a temporary directory removed after use. |
