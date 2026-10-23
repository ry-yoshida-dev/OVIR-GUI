import json
import os
import re
from pathlib import Path
from typing import ClassVar

import pytest


class GoldenSnapshot:
    """
    JSON documents compared with files recorded from a known-good run, under ``tests/golden``.

    Temporary paths, preview versions, export timestamps, machine-dependent device support and timings are replaced
    by placeholders before comparing. Set ``OVIR_GUI_UPDATE_GOLDEN=1`` to record the documents again.
    """

    DIRECTORY: ClassVar[Path] = Path(__file__).parent / "golden"
    UPDATE_VARIABLE: ClassVar[str] = "OVIR_GUI_UPDATE_GOLDEN"
    VOLATILE_KEYS: ClassVar[frozenset[str]] = frozenset(
        {"version", "default_directory", "devices", "precisions", "is_installed"}
    )
    TIMING_PATTERN: ClassVar[re.Pattern[str]] = re.compile(r"\d+ ms/picture")

    def __init__(self, temporary_directory: Path) -> None:
        """
        Parameters
        ----------
        temporary_directory : Path
            Directory of the test, replaced by ``<tmp>``.
        """
        self._temporary_text: str = str(temporary_directory)

    def normalized(self, document: object) -> object:
        """
        Document with its volatile parts replaced.

        Parameters
        ----------
        document : object
            Parsed JSON.

        Returns
        -------
        object
            Same structure with placeholders.
        """
        match document:
            case dict():
                return {
                    str(key): (
                        "<volatile>" if key in self.VOLATILE_KEYS and value is not None else self.normalized(value)
                    )
                    for key, value in document.items()
                }
            case list():
                return [self.normalized(value) for value in document]
            case str():
                replaced: str = document.replace(self._temporary_text, "<tmp>")
                return self.TIMING_PATTERN.sub("<ms> ms/picture", replaced)
            case _:
                return document

    def assert_matches(self, name: str, document: object) -> None:
        """
        Compare a document with its recorded file, recording it when asked to.

        Parameters
        ----------
        name : str
            File stem under ``tests/golden``.
        document : object
            Parsed JSON.
        """
        path: Path = self.DIRECTORY / f"{name}.json"
        actual: object = self.normalized(document)
        if os.environ.get(self.UPDATE_VARIABLE) == "1":
            self.DIRECTORY.mkdir(parents=True, exist_ok=True)
            _ = path.write_text(json.dumps(actual, indent=2, ensure_ascii=False, sort_keys=True) + "\n", "utf-8")
            return
        if not path.is_file():
            pytest.fail(f"{path.name} is not recorded; run with {self.UPDATE_VARIABLE}=1.")
        expected: object = json.loads(path.read_text("utf-8"))
        assert actual == expected, f"{name} differs from {path}"
