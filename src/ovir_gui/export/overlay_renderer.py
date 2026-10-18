from collections.abc import Mapping
from typing import ClassVar

import numpy as np
from PIL import Image, ImageColor, ImageDraw, ImageFont

from ..recognition import ClassScore, FrameResult, RecognizedInstance
from ..recognition.array_types import BoolArray


class OverlayRenderer:
    """
    Draws a result over its picture: tinted masks, boxes with labels, or the top classes of a classification.

    Colors follow the classes, line widths and fonts the picture size, so drawings look alike at any resolution.
    """

    REFERENCE_SIDE: ClassVar[float] = 1000.0
    BASE_LINE_WIDTH: ClassVar[float] = 3.0
    BASE_FONT_SIZE: ClassVar[float] = 18.0
    MINIMUM_FONT_SIZE: ClassVar[float] = 11.0
    MASK_OPACITY: ClassVar[float] = 0.45
    CLASSIFICATION_LINES: ClassVar[int] = 3
    LIGHT_LUMINANCE: ClassVar[float] = 0.6
    FALLBACK_COLOR: ClassVar[str] = "#e6194b"

    def __init__(self, class_colors: Mapping[str, str], is_confidence_shown: bool = True) -> None:
        """
        Parameters
        ----------
        class_colors : Mapping[str, str]
            ``#rrggbb`` color of every class.
        is_confidence_shown : bool, optional
            Whether labels carry the confidence.
        """
        self._class_colors: dict[str, tuple[int, int, int]] = {
            name: self._rgb_of(color) for name, color in class_colors.items()
        }
        self._is_confidence_shown: bool = is_confidence_shown

    def render(self, picture: Image.Image, result: FrameResult, label: str | None = None) -> Image.Image:
        """
        Draw a result over a copy of its picture.

        Parameters
        ----------
        picture : Image.Image
            RGB picture the result was recognized in.
        result : FrameResult
            Findings to draw.
        label : str | None, optional
            Class shown first for a classification; its top class by default.

        Returns
        -------
        Image.Image
            Annotated RGB copy.
        """
        canvas: Image.Image = picture.convert("RGB")
        if result.class_scores:
            return self._draw_scores(canvas, result, label)
        masked: list[RecognizedInstance] = [instance for instance in result.instances if instance.mask is not None]
        if masked:
            canvas = self._tint_masks(canvas, masked)
        return self._draw_boxes(canvas, result.instances)

    def _tint_masks(self, canvas: Image.Image, instances: list[RecognizedInstance]) -> Image.Image:
        pixels: np.ndarray = np.asarray(canvas, dtype=np.float64).copy()
        for instance in sorted(instances, key=lambda item: item.confidence):
            if instance.mask is None:
                continue
            region: BoolArray = instance.mask.dense(canvas.width, canvas.height)
            color: np.ndarray = np.array(self._color_of(instance.class_name), dtype=np.float64)
            pixels[region] = (1.0 - self.MASK_OPACITY) * pixels[region] + self.MASK_OPACITY * color
        return Image.fromarray(pixels.round().clip(0, 255).astype(np.uint8), mode="RGB")

    def _draw_boxes(self, canvas: Image.Image, instances: tuple[RecognizedInstance, ...]) -> Image.Image:
        scale: float = max(canvas.size) / self.REFERENCE_SIDE
        line_width: int = max(1, round(self.BASE_LINE_WIDTH * scale))
        font: ImageFont.FreeTypeFont | ImageFont.ImageFont = self._font(scale)
        draw: ImageDraw.ImageDraw = ImageDraw.Draw(canvas)
        padding: int = max(1, line_width)
        for instance in instances:
            color: tuple[int, int, int] = self._color_of(instance.class_name)
            left, top, right, bottom = instance.box.xyxy
            draw.rectangle((left, top, right, bottom), outline=color, width=line_width)
            text: str = (
                f"{instance.class_name} {instance.confidence:.2f}" if self._is_confidence_shown else instance.class_name
            )
            text_left, text_top, text_right, text_bottom = draw.textbbox((0, 0), text, font=font)
            label_height: float = text_bottom - text_top + 2 * padding
            label_top: float = top - label_height if top >= label_height else top
            draw.rectangle(
                (left, label_top, left + text_right - text_left + 2 * padding, label_top + label_height), fill=color
            )
            draw.text(
                (left + padding - text_left, label_top + padding - text_top),
                text,
                fill=self._text_color_on(color),
                font=font,
            )
        return canvas

    def _draw_scores(self, canvas: Image.Image, result: FrameResult, label: str | None) -> Image.Image:
        scale: float = max(canvas.size) / self.REFERENCE_SIDE
        font: ImageFont.FreeTypeFont | ImageFont.ImageFont = self._font(scale * 1.2)
        draw: ImageDraw.ImageDraw = ImageDraw.Draw(canvas)
        ranked: list[ClassScore] = list(result.ranked_scores[: self.CLASSIFICATION_LINES])
        if label is not None:
            ranked.sort(key=lambda score: score.class_name != label)
        padding: int = max(2, round(4 * scale))
        top: float = padding
        for score in ranked:
            color: tuple[int, int, int] = self._color_of(score.class_name)
            text: str = f"{score.class_name} {score.score:.2f}" if self._is_confidence_shown else score.class_name
            text_left, text_top, text_right, text_bottom = draw.textbbox((0, 0), text, font=font)
            height: float = text_bottom - text_top + 2 * padding
            draw.rectangle((padding, top, padding + text_right - text_left + 2 * padding, top + height), fill=color)
            draw.text(
                (2 * padding - text_left, top + padding - text_top), text, fill=self._text_color_on(color), font=font
            )
            top += height + padding
        return canvas

    def _font(self, scale: float) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
        return ImageFont.load_default(size=max(self.MINIMUM_FONT_SIZE, self.BASE_FONT_SIZE * scale))

    def _color_of(self, class_name: str) -> tuple[int, int, int]:
        return self._class_colors.get(class_name, self._rgb_of(self.FALLBACK_COLOR))

    @staticmethod
    def _rgb_of(color: str) -> tuple[int, int, int]:
        rgb: tuple[int, ...] = ImageColor.getrgb(color)
        return (rgb[0], rgb[1], rgb[2])

    @classmethod
    def _text_color_on(cls, background: tuple[int, int, int]) -> tuple[int, int, int]:
        red, green, blue = (channel / 255.0 for channel in background)
        luminance: float = 0.299 * red + 0.587 * green + 0.114 * blue
        return (0, 0, 0) if luminance > cls.LIGHT_LUMINANCE else (255, 255, 255)
