# recognition

## Overview

Request bodies of `RecognitionRoutes`: running recognitions and choosing profiles, with the bodies of the model settings and of reviewing results in sub-packages. `RunAllBody` extends `ApprovalBody`.

## Components

| Component | Description |
| --- | --- |
| [model_settings/](./model_settings/README.md) | Request bodies of the model settings: task, preset and overrides, licenses, weights, label mode and text templates. |
| [review/](./review/README.md) | Request bodies of reviewing results: acceptance, the result table, thresholds and overlap suppression. |
| [approval.py](./approval.py) | `ApprovalBody` is a request that may need the user's approval to leave out classes. |
| [profile.py](./profile.py) | `ProfileBody` names a stored model profile, or none. |
| [profiles.py](./profiles.py) | `ProfilesBody` names stored model profiles removed at once. |
| [run_all.py](./run_all.py) | `RunAllBody` runs every picture lacking a result, the shown video optionally from a given frame onward. |
