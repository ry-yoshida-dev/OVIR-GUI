from ...media import ClassColors, FrameKey
from ...prompting import ExemplarBox, ObjectMark, PicturePrompts, ReferenceBoard
from ...review import ClassThresholds, DuplicateSuppression
from ...storage import ClassSet, ClassSetEntry, JsonValue
from ...workspace import ClassWorkbench
from ..json_object import JsonObject


class ClassViewBuilder:
    """
    JSON documents of the classes: the edited classes with their phrases, reference images and counts of drawings,
    saved class sets, and the class minimums and duplicate suppression reviewing their findings.
    """

    def classes(self, workbench: ClassWorkbench) -> list[JsonValue]:
        """
        Classes being edited.

        Parameters
        ----------
        workbench : ClassWorkbench
            Classes and reference images of the workspace.

        Returns
        -------
        list[JsonValue]
            Name, color, phrases, reference images, pictures drawn on and counts of exemplar boxes and marked
            objects of every class, in class order.
        """
        board: ReferenceBoard = workbench.reference_board
        prompts: PicturePrompts = workbench.picture_board.prompts
        return [
            self._class(index, definition.name, definition.text_queries, board, prompts)
            for index, definition in enumerate(workbench.classes)
        ]

    @staticmethod
    def class_set_state(workbench: ClassWorkbench) -> JsonObject:
        """
        Class set the classes were loaded from or saved as.

        Parameters
        ----------
        workbench : ClassWorkbench
            Classes of the workspace.

        Returns
        -------
        JsonObject
            Set name, whether the classes changed since, saved set names and their directory.
        """
        return {
            "name": workbench.class_set_name,
            "is_edited": workbench.is_edited,
            "is_unsaved": workbench.is_unsaved,
            "names": list[JsonValue](workbench.class_set_store.class_set_names),
            "directory": str(workbench.class_set_store.class_set_directory),
        }

    @staticmethod
    def thresholds(thresholds: ClassThresholds) -> JsonObject:
        """
        Minimum confidences of the current task.

        Parameters
        ----------
        thresholds : ClassThresholds
            Default, class and prompt minimums.

        Returns
        -------
        JsonObject
            Default minimum and the own minimums of classes and prompts.
        """
        class_minimums: JsonObject = dict(thresholds.class_minimums)
        prompt_minimums: JsonObject = {
            class_name: dict[str, JsonValue](by_prompt) for class_name, by_prompt in thresholds.prompt_minimums.items()
        }
        return {
            "default_minimum": thresholds.default_minimum,
            "class_minimums": class_minimums,
            "prompt_minimums": prompt_minimums,
        }

    @staticmethod
    def suppression(suppression: DuplicateSuppression) -> JsonObject:
        """
        Duplicate suppression of the current task.

        Parameters
        ----------
        suppression : DuplicateSuppression
            Whether and how overlapping findings are suppressed.

        Returns
        -------
        JsonObject
            Whether it is enabled, the overlap threshold and the own thresholds of classes.
        """
        class_overlaps: JsonObject = dict(suppression.class_overlap_thresholds)
        return {
            "is_enabled": suppression.is_enabled,
            "overlap_threshold": suppression.overlap_threshold,
            "class_overlap_thresholds": class_overlaps,
        }

    @staticmethod
    def class_set_entries(entries: tuple[ClassSetEntry, ...]) -> JsonObject:
        """
        Saved class sets.

        Parameters
        ----------
        entries : tuple[ClassSetEntry, ...]
            Listed sets.

        Returns
        -------
        JsonObject
            Name, save time, class names and description of every set.
        """
        listed: list[JsonValue] = []
        for entry in entries:
            class_names: list[JsonValue] = [] if entry.summary is None else list(entry.summary.class_names)
            listed.append(
                {
                    "name": entry.name,
                    "saved_at": entry.saved_at.isoformat(timespec="seconds"),
                    "is_readable": entry.is_readable,
                    "class_names": class_names,
                    "description": "" if entry.summary is None else entry.summary.description,
                }
            )
        return {"entries": listed}

    def class_set_preview(self, name: str, class_set: ClassSet) -> JsonObject:
        """
        Classes, phrases and image prompts of one saved class set.

        Parameters
        ----------
        name : str
            Set name.
        class_set : ClassSet
            Content of the set.

        Returns
        -------
        JsonObject
            Name and classes with their phrases and reference images.
        """
        board: ReferenceBoard = ReferenceBoard()
        board.replace(class_set.reference_boxes, class_set.reference_pixels)
        return {
            "name": name,
            "classes": [
                self._class(index, definition.name, definition.text_queries, board, PicturePrompts())
                for index, definition in enumerate(class_set.classes)
            ],
        }

    @staticmethod
    def _class(
        index: int, name: str, phrases: tuple[str, ...], board: ReferenceBoard, prompts: PicturePrompts
    ) -> JsonObject:
        references: list[JsonValue] = []
        for reference_image in board.reference_images_of(name):
            width, height = board.pixels_of(reference_image).size
            boxes: list[JsonValue] = [list[JsonValue](box.xyxy) for box in board.boxes_of(name, reference_image)]
            references.append(
                {
                    "name": reference_image.name,
                    "digest": reference_image.digest,
                    "width": width,
                    "height": height,
                    "boxes": boxes,
                }
            )
        return {
            "name": name,
            "color": ClassColors.hex_of(index),
            "phrases": list[JsonValue](phrases),
            "references": references,
            "exemplar_count": sum(1 for box in prompts.exemplars if box.class_name == name),
            "object_count": len(
                {(mark.frame_key.path, mark.object_id) for mark in prompts.marks if mark.class_name == name}
            ),
            "drawings": ClassViewBuilder._drawings(name, prompts),
        }

    @staticmethod
    def _drawings(name: str, prompts: PicturePrompts) -> list[JsonValue]:
        """
        What is drawn for one class, picture by picture.

        Parameters
        ----------
        name : str
            Class name.
        prompts : PicturePrompts
            Every drawing of the open pictures.

        Returns
        -------
        list[JsonValue]
            Per picture in picture order, its exemplar boxes of the class as one entry, then every object mark of
            the class in object order. Exemplar indices count every box of the picture, as removal takes them.
        """
        keys: set[FrameKey] = {box.frame_key for box in prompts.exemplars if box.class_name == name} | {
            mark.frame_key for mark in prompts.marks if mark.class_name == name
        }
        drawings: list[JsonValue] = []
        for frame_key in sorted(keys, key=lambda key: key.sort_key()):
            picture: JsonObject = {
                "path": str(frame_key.path),
                "frame": frame_key.frame_index,
                "label": frame_key.label,
            }
            on_picture: tuple[ExemplarBox, ...] = prompts.of(frame_key).exemplars
            boxes: list[JsonValue] = [
                {"index": index, "box": list[JsonValue](box.xyxy), "is_positive": box.is_positive}
                for index, box in enumerate(on_picture)
                if box.class_name == name
            ]
            if boxes:
                drawings.append({**picture, "kind": "exemplar", "boxes": boxes})
            marks: list[ObjectMark] = [mark for mark in prompts.of(frame_key).marks if mark.class_name == name]
            drawings.extend(
                {
                    **picture,
                    "kind": "mark",
                    "object_id": mark.object_id,
                    "positive_points": [list[JsonValue](point) for point in mark.positive_points],
                    "negative_points": [list[JsonValue](point) for point in mark.negative_points],
                    "box": None if mark.box is None else list[JsonValue](mark.box),
                }
                for mark in marks
            )
        return drawings
