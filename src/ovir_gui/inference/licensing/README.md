# licensing

## Overview

Optional modules of restrictive licenses: a model reports the `LicensedDependency` modules it needs, and `LicenseConsent` refuses it, without importing the module, until the user accepts the license.

## Components

| Component | Description |
| --- | --- |
| [consent.py](./consent.py) | `LicenseConsent` records the licensed modules the user accepted in this session and refuses models needing others. |
| [dependency.py](./dependency.py) | `LicensedDependency` enumerates optional modules of restrictive licenses (Ultralytics, AGPL-3.0) with their terms and install command. |
