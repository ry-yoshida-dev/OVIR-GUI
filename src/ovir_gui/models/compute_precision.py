from enum import Enum


class ComputePrecision(Enum):
    """
    Floating-point type a model runs in, mapped onto the precision setting of each model library.

    Attributes
    ----------
    FLOAT32 : str
        Single precision; runs everywhere.
    FLOAT16 : str
        Half precision; GPU only.
    BFLOAT16 : str
        Brain floating point; float32 range with float16 memory, for libraries and devices supporting it.
    """

    FLOAT32 = "float32"
    FLOAT16 = "float16"
    BFLOAT16 = "bfloat16"

    @property
    def short_name(self) -> str:
        """
        Name shown in tables.

        Returns
        -------
        str
            ``"fp32"``, ``"fp16"`` or ``"bf16"``.
        """
        match self:
            case ComputePrecision.FLOAT32:
                return "fp32"
            case ComputePrecision.FLOAT16:
                return "fp16"
            case ComputePrecision.BFLOAT16:
                return "bf16"
