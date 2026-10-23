import asyncio
import tempfile
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import UploadFile


class TemporaryUpload:
    """
    File uploaded with a request, written to a temporary directory that is removed after use.
    """

    @staticmethod
    @asynccontextmanager
    async def saved(file: UploadFile, fallback_name: str) -> AsyncGenerator[Path]:
        """
        Write an uploaded file to a temporary directory under its own name.

        Parameters
        ----------
        file : UploadFile
            Uploaded file.
        fallback_name : str
            File name used when the upload has none.

        Yields
        ------
        Path
            Written file, removed with its directory when the block ends.

        Raises
        ------
        OSError
            If the file cannot be written.
        """
        file_name: str = Path(file.filename or fallback_name).name
        content: bytes = await file.read()
        with tempfile.TemporaryDirectory() as directory:
            path: Path = Path(directory) / file_name
            await asyncio.to_thread(path.write_bytes, content)
            yield path
