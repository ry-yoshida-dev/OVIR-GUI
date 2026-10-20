from collections.abc import Sequence

from open_vocabulary_segmentation import AutomaticMaskGenerator, GeneratedMask, MaskGenerationResult

from ..media import KeyedPicture
from ..prompting import LabeledPrompt
from ..recognition import FrameResult, ImageSize, InstanceMask, RecognitionTask, RecognizedInstance
from .mask_generation_model import MaskGenerationModel
from .recognition_model import RecognitionModel
from .recognizer import Recognizer


class MaskGenerationRecognizer(Recognizer):
    """
    Loaded automatic mask generator; every region becomes an instance of ``MaskGenerationModel.REGION_CLASS_NAME``.
    """

    def __init__(self, model: MaskGenerationModel) -> None:
        """
        Load the promptable segmenter behind the generator.

        Parameters
        ----------
        model : MaskGenerationModel
            Settings to load.
        """
        self._model: MaskGenerationModel = model
        self._generator: AutomaticMaskGenerator = model.settings.build()

    @property
    def model(self) -> RecognitionModel:
        return self._model

    def adopt(self, model: RecognitionModel) -> None:
        if not isinstance(model, MaskGenerationModel):
            raise TypeError(f"a mask generator cannot run {model.backend} settings.")
        self.require_reusable(model)
        self._model = model
        self._generator.options = model.settings.options

    def recognize(self, pictures: Sequence[KeyedPicture], prompt: LabeledPrompt) -> list[FrameResult]:
        results: list[MaskGenerationResult] = self._generator.generate_images([picture.image for picture in pictures])
        return [self._convert(result) for result in results]

    @staticmethod
    def _convert(result: MaskGenerationResult) -> FrameResult:
        instances: list[RecognizedInstance] = []
        for region in result.sort_by_score():
            instance: RecognizedInstance | None = MaskGenerationRecognizer._instance_of(region)
            if instance is not None:
                instances.append(instance)
        return FrameResult(
            task=RecognitionTask.SEGMENTATION,
            image_size=ImageSize(width=result.image_size.width, height=result.image_size.height),
            instances=tuple(instances),
        )

    @staticmethod
    def _instance_of(region: GeneratedMask) -> RecognizedInstance | None:
        mask: InstanceMask | None = InstanceMask.from_dense(region.mask)
        if mask is None:
            return None
        return RecognizedInstance(
            class_name=MaskGenerationModel.REGION_CLASS_NAME,
            query_label=MaskGenerationModel.QUERY_LABEL,
            confidence=float(region.score),
            box=mask.box,
            mask=mask,
        )
