from dataclasses import dataclass
from importlib.resources import files
from typing import ClassVar

from pydantic import TypeAdapter

from .model_benchmark import ModelBenchmark


@dataclass(frozen=True)
class BenchmarkCatalog:
    """
    Accuracy and compute of the detection checkpoints, by weights path.

    The AP comes from the papers and model cards; the GFLOPs are counted on the Hugging Face model of each checkpoint
    with a prompt of ``phrase_count`` phrases.

    Attributes
    ----------
    phrase_count : int
        Phrases of the prompt the GFLOPs are counted with.
    models : dict[str, ModelBenchmark]
        Benchmark of each checkpoint, by weights path, e.g. ``"google/owlv2-base-patch16"``.
    """

    PACKAGE_NAME: ClassVar[str] = "ovir_gui.models"
    RESOURCE_NAME: ClassVar[str] = "model_benchmarks.json"

    phrase_count: int
    models: dict[str, ModelBenchmark]

    @classmethod
    def bundled(cls) -> "BenchmarkCatalog":
        """
        Catalog shipped with the package.

        Returns
        -------
        BenchmarkCatalog
            Benchmarks read from ``model_benchmarks.json``.

        Raises
        ------
        pydantic.ValidationError
            If the file does not hold the expected fields.
        """
        text: str = files(cls.PACKAGE_NAME).joinpath(cls.RESOURCE_NAME).read_text(encoding="utf-8")
        return TypeAdapter(cls).validate_json(text)

    def benchmark_of(self, weights_path: str) -> ModelBenchmark | None:
        """
        Benchmark of a checkpoint.

        Parameters
        ----------
        weights_path : str
            Weights path of the checkpoint.

        Returns
        -------
        ModelBenchmark | None
            Its benchmark, or ``None`` when the checkpoint is not listed.
        """
        return self.models.get(weights_path)
