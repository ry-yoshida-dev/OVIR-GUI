# compute

## Overview

Where and in which floating-point type a model runs: `ComputeDevice` and `ComputePrecision` map onto the settings of each library, and `DeviceAvailability` reports what this machine can run.

## Components

| Component | Description |
| --- | --- |
| [device.py](./device.py) | `ComputeDevice` enumerates the devices a model runs on, mapped onto each library's device type. |
| [device_availability.py](./device_availability.py) | `DeviceAvailability` reports the GPU backends present on this machine and which settings can run. |
| [precision.py](./precision.py) | `ComputePrecision` enumerates the floating-point types a model runs in (float32, float16, bfloat16). |
