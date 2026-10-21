import json
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import ClassVar

from ..models import LicensedDependency
from .json_fields import JsonFields, JsonValue


class LicenseConsentStore:
    """
    Licensed modules the user accepted, remembered between runs in ``license_consent.json`` of a data directory.

    The file looks like ``{"ultralytics": {"accepted_at": "2026-10-21T09:00:00+00:00"}}``, recording when each license
    was accepted. Deleting the file asks for every license again. The directory is created only when written to.
    """

    FILE_NAME: ClassVar[str] = "license_consent.json"
    ACCEPTED_AT_KEY: ClassVar[str] = "accepted_at"

    def __init__(self, root_directory: Path) -> None:
        """
        Parameters
        ----------
        root_directory : Path
            Data directory holding the file.
        """
        self._root_directory: Path = root_directory

    @property
    def path(self) -> Path:
        """
        File holding the accepted licenses.

        Returns
        -------
        Path
            ``license_consent.json`` in the data directory, whether or not it exists.
        """
        return self._root_directory / self.FILE_NAME

    def load(self) -> frozenset[LicensedDependency]:
        """
        Read the accepted licenses.

        Returns
        -------
        frozenset[LicensedDependency]
            Accepted modules; none when the file is missing or unreadable.
        """
        known_values: set[str] = {dependency.value for dependency in LicensedDependency}
        return frozenset(LicensedDependency(value) for value in self._read_entries() if value in known_values)

    def save(self, accepted: Iterable[LicensedDependency]) -> None:
        """
        Remember the accepted licenses, keeping the time each one was first accepted.

        Parameters
        ----------
        accepted : Iterable[LicensedDependency]
            Accepted modules.

        Raises
        ------
        OSError
            If the data directory or the file cannot be written.
        """
        previous: dict[str, JsonValue] = self._read_entries()
        now: str = datetime.now(UTC).isoformat(timespec="seconds")
        content: dict[str, JsonValue] = {
            dependency.value: previous.get(dependency.value, {self.ACCEPTED_AT_KEY: now})
            for dependency in sorted(accepted, key=lambda entry: entry.value)
        }
        self._root_directory.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")

    def _read_entries(self) -> dict[str, JsonValue]:
        if not self.path.is_file():
            return {}
        try:
            return JsonFields.object_of(JsonFields.parse(self.path.read_text(encoding="utf-8")), "license consent")
        except (OSError, UnicodeDecodeError, json.JSONDecodeError, TypeError):
            return {}
