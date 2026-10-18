from dataclasses import dataclass

import torch

from .compute_device import ComputeDevice
from .compute_precision import ComputePrecision


@dataclass(frozen=True)
class DeviceAvailability:
    """
    GPU backends present on this machine, deciding which settings can run here.

    Attributes
    ----------
    is_cuda_available : bool
        Whether a CUDA GPU is usable.
    is_mps_available : bool
        Whether the Apple Silicon GPU is usable through Metal Performance Shaders.
    """

    is_cuda_available: bool
    is_mps_available: bool

    @classmethod
    def detect(cls) -> "DeviceAvailability":
        """
        Probe the GPU backends of this machine.

        Returns
        -------
        DeviceAvailability
            Backends PyTorch can use.
        """
        return cls(
            is_cuda_available=torch.cuda.is_available(),
            is_mps_available=torch.backends.mps.is_available(),
        )

    def is_available(self, device: ComputeDevice) -> bool:
        """
        Whether a device can be requested on this machine.

        Parameters
        ----------
        device : ComputeDevice
            Requested device.

        Returns
        -------
        bool
            True for ``AUTO`` and ``CPU``, and for a GPU backend present on this machine.
        """
        match device:
            case ComputeDevice.AUTO | ComputeDevice.CPU:
                return True
            case ComputeDevice.CUDA:
                return self.is_cuda_available
            case ComputeDevice.MPS:
                return self.is_mps_available

    def is_half_precision_supported(self, device: ComputeDevice) -> bool:
        """
        Whether float16 can run on a device, i.e. whether it resolves to an available GPU.

        Parameters
        ----------
        device : ComputeDevice
            Requested device.

        Returns
        -------
        bool
            True if the device resolves to an available GPU.
        """
        match device:
            case ComputeDevice.AUTO:
                return self.is_cuda_available or self.is_mps_available
            case ComputeDevice.CPU:
                return False
            case ComputeDevice.CUDA | ComputeDevice.MPS:
                return self.is_available(device)

    def is_precision_supported(self, device: ComputeDevice, precision: ComputePrecision) -> bool:
        """
        Whether a precision can run on a device.

        Parameters
        ----------
        device : ComputeDevice
            Requested device.
        precision : ComputePrecision
            Requested precision.

        Returns
        -------
        bool
            Always for float32 and bfloat16; for float16 only when the device resolves to an available GPU.
        """
        match precision:
            case ComputePrecision.FLOAT32 | ComputePrecision.BFLOAT16:
                return True
            case ComputePrecision.FLOAT16:
                return self.is_half_precision_supported(device)
