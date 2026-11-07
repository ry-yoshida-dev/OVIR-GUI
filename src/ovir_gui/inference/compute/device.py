from enum import Enum


class ComputeDevice(Enum):
    """
    Device a model runs on, mapped by value onto the device type of each model library.

    Attributes
    ----------
    AUTO : str
        Best available device: CUDA, then Apple Silicon, then CPU.
    CPU : str
        CPU.
    CUDA : str
        Current CUDA GPU.
    MPS : str
        Apple Silicon GPU through Metal Performance Shaders.
    """

    AUTO = "auto"
    CPU = "cpu"
    CUDA = "cuda"
    MPS = "mps"
