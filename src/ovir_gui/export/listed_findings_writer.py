import csv
import io
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import ClassVar

from ..media import FrameKey, MediaItem
from ..recognition import Finding
from ..results import ResultCatalog, StoredResult


class ListedFindingsWriter:
    """
    Writes the findings a result table lists, in display order, as CSV text.

    Columns are media, frame, seconds, class, matched prompt, confidence, box corners, area and whether the finding is
    kept.
    """

    HEADER: ClassVar[tuple[str, ...]] = (
        "media",
        "frame",
        "seconds",
        "class",
        "matched_prompt",
        "confidence",
        "x_min",
        "y_min",
        "x_max",
        "y_max",
        "area",
        "kept",
    )

    def __init__(self, catalog: ResultCatalog, media: Mapping[Path, MediaItem] | None = None) -> None:
        """
        Parameters
        ----------
        catalog : ResultCatalog
            Results the findings belong to.
        media : Mapping[Path, MediaItem] | None, optional
            Open media by path, giving frame times.
        """
        self._catalog: ResultCatalog = catalog
        self._media: Mapping[Path, MediaItem] = media or {}

    def write(self, findings: Sequence[tuple[FrameKey, int]]) -> bytes:
        """
        Build the table.

        Parameters
        ----------
        findings : Sequence[tuple[FrameKey, int]]
            Picture and finding index of every listed row.

        Returns
        -------
        bytes
            UTF-8 CSV text with a header.

        Raises
        ------
        KeyError
            If a picture has no result.
        IndexError
            If a finding index is outside its result.
        """
        buffer: io.StringIO = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(self.HEADER)
        for frame_key, index in findings:
            stored: StoredResult | None = self._catalog.stored_of(frame_key)
            if stored is None:
                raise KeyError(f"{frame_key.label} has not been recognized.")
            if not 0 <= index < stored.result.candidate_count:
                raise IndexError(f"No finding {index} in {frame_key.label}.")
            finding: Finding = stored.result.finding_of(index)
            item: MediaItem | None = self._media.get(frame_key.path)
            seconds: str = (
                ""
                if item is None or item.video is None or frame_key.frame_index is None
                else f"{item.video.seconds_of(frame_key.frame_index):.3f}"
            )
            corners: tuple[str, ...] = (
                ("", "", "", "") if finding.box is None else tuple(f"{value:.2f}" for value in finding.box.xyxy)
            )
            writer.writerow(
                (
                    str(frame_key.path),
                    "" if frame_key.frame_index is None else str(frame_key.frame_index),
                    seconds,
                    finding.class_name,
                    finding.matched_prompt,
                    f"{finding.confidence:.6f}",
                    *corners,
                    "" if finding.area is None else f"{finding.area:.0f}",
                    "yes" if stored.is_accepted(index) else "no",
                )
            )
        return buffer.getvalue().encode("utf-8")
