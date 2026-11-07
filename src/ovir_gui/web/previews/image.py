from dataclasses import dataclass
from typing import ClassVar

from fastapi import Response


@dataclass(frozen=True)
class ImagePreview:
    """
    Encoded image a browser can display.

    Attributes
    ----------
    content : bytes
        Encoded pixels.
    media_type : str
        MIME type of ``content``.
    """

    CACHE_CONTROL: ClassVar[str] = "private, max-age=86400"

    content: bytes
    media_type: str

    def response(self) -> Response:
        """
        HTTP response carrying the image, cached by the browser for a day.

        Returns
        -------
        Response
            Response with the encoded pixels.
        """
        return Response(
            content=self.content,
            media_type=self.media_type,
            headers={"Cache-Control": self.CACHE_CONTROL},
        )
