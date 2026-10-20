from pathlib import Path

from ..media import FrameKey
from ..prompting import ExemplarBox, ObjectMark
from .json_fields import JsonFields, JsonValue


class PicturePromptCodec:
    """
    JSON form of the exemplar boxes and object marks drawn on pictures, shared by the results archive and the
    remembered drawings.

    ```text
    exemplar: {"path": "/data/a.jpg", "frame": null, "class": "car", "xyxy": [10, 20, 200, 120], "positive": true}
    mark:     {"path": "/data/v.mp4", "frame": 30, "object": 1, "class": "car",
               "positive": [[120, 80]], "negative": [], "box": null}
    ```
    """

    @staticmethod
    def exemplar_entry(box: ExemplarBox) -> JsonValue:
        """
        JSON form of an exemplar box.

        Parameters
        ----------
        box : ExemplarBox
            Box to write.

        Returns
        -------
        JsonValue
            Object with its picture, class, corners and polarity.
        """
        return {
            "path": str(box.frame_key.path),
            "frame": box.frame_key.frame_index,
            "class": box.class_name,
            "xyxy": list[JsonValue](box.xyxy),
            "positive": box.is_positive,
        }

    @classmethod
    def exemplar_of(cls, value: JsonValue) -> ExemplarBox:
        """
        Read an exemplar box.

        Parameters
        ----------
        value : JsonValue
            Object written by ``exemplar_entry``.

        Returns
        -------
        ExemplarBox
            The box.

        Raises
        ------
        TypeError
            If a field has the wrong type.
        ValueError
            If the corners are not four numbers or describe no box.
        """
        entry: dict[str, JsonValue] = JsonFields.object_of(value, "exemplar")
        corners: tuple[float, ...] = cls._numbers_of(entry.get("xyxy"), "xyxy", 4)
        return ExemplarBox(
            frame_key=cls._frame_key_of(entry),
            class_name=JsonFields.string_of(entry.get("class"), "class"),
            left=corners[0],
            top=corners[1],
            right=corners[2],
            bottom=corners[3],
            is_positive=JsonFields.boolean_of(entry.get("positive", True), "positive"),
        )

    @staticmethod
    def mark_entry(mark: ObjectMark) -> JsonValue:
        """
        JSON form of an object mark.

        Parameters
        ----------
        mark : ObjectMark
            Mark to write.

        Returns
        -------
        JsonValue
            Object with its picture, object, class, points and box.
        """
        return {
            "path": str(mark.frame_key.path),
            "frame": mark.frame_key.frame_index,
            "object": mark.object_id,
            "class": mark.class_name,
            "positive": [list[JsonValue](point) for point in mark.positive_points],
            "negative": [list[JsonValue](point) for point in mark.negative_points],
            "box": None if mark.box is None else list[JsonValue](mark.box),
        }

    @classmethod
    def mark_of(cls, value: JsonValue) -> ObjectMark:
        """
        Read an object mark.

        Parameters
        ----------
        value : JsonValue
            Object written by ``mark_entry``.

        Returns
        -------
        ObjectMark
            The mark.

        Raises
        ------
        TypeError
            If a field has the wrong type.
        ValueError
            If a point or the box has the wrong length, or nothing marks the object.
        """
        entry: dict[str, JsonValue] = JsonFields.object_of(value, "mark")
        box_value: JsonValue = entry.get("box")
        box: tuple[float, ...] | None = None if box_value is None else cls._numbers_of(box_value, "box", 4)
        return ObjectMark(
            frame_key=cls._frame_key_of(entry),
            object_id=JsonFields.integer_of(entry.get("object"), "object"),
            class_name=JsonFields.string_of(entry.get("class"), "class"),
            positive_points=cls._points_of(entry.get("positive", []), "positive"),
            negative_points=cls._points_of(entry.get("negative", []), "negative"),
            box=None if box is None else (box[0], box[1], box[2], box[3]),
        )

    @staticmethod
    def _frame_key_of(entry: dict[str, JsonValue]) -> FrameKey:
        frame: JsonValue = entry.get("frame")
        return FrameKey(
            Path(JsonFields.string_of(entry.get("path"), "path")),
            None if frame is None else JsonFields.integer_of(frame, "frame"),
        )

    @classmethod
    def _points_of(cls, value: JsonValue, description: str) -> tuple[tuple[float, float], ...]:
        points: list[tuple[float, float]] = []
        for point_value in JsonFields.list_of(value, description):
            coordinates: tuple[float, ...] = cls._numbers_of(point_value, description, 2)
            points.append((coordinates[0], coordinates[1]))
        return tuple(points)

    @staticmethod
    def _numbers_of(value: JsonValue, description: str, count: int) -> tuple[float, ...]:
        numbers: tuple[float, ...] = tuple(
            JsonFields.number_of(number, description) for number in JsonFields.list_of(value, description)
        )
        if len(numbers) != count:
            raise ValueError(f"{description} needs {count} numbers. got {list(numbers)}")
        return numbers
