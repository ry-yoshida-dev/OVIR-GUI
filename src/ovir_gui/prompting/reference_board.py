from collections.abc import Mapping, Sequence

from PIL import Image

from ..vocabulary import ClassDefinition
from .prompt_class import PromptClass
from .prompt_signature import PromptSignature
from .queried_class import QueriedClass
from .query_kind import QueryKind
from .reference_box import ReferenceBox
from .reference_image import ReferenceImage
from .visual_example import VisualExample


class ReferenceBoard:
    """
    Reference boxes drawn on reference images, turned into the queried classes of a recognition run.

    The boxes of one class on one reference image form one visual query: detectors average the embeddings of the
    boxes, classifiers the embeddings of the crops. Different images of a class are separate queries, so a sedan photo
    and a van photo are each matched on their own. Boxes are attached to class names, so they follow renames and stay
    valid when other classes are added or removed.
    """

    def __init__(self) -> None:
        self._boxes: list[ReferenceBox] = []
        self._images: dict[ReferenceImage, Image.Image] = {}

    @property
    def boxes(self) -> tuple[ReferenceBox, ...]:
        """
        Every reference box in drawing order.

        Returns
        -------
        tuple[ReferenceBox, ...]
            Boxes on all images.
        """
        return tuple(self._boxes)

    @property
    def is_empty(self) -> bool:
        """
        Whether no reference box exists.

        Returns
        -------
        bool
            True without any box.
        """
        return not self._boxes

    @property
    def reference_images(self) -> tuple[ReferenceImage, ...]:
        """
        Every image holding a box.

        Returns
        -------
        tuple[ReferenceImage, ...]
            Images in the order their first box was added.
        """
        return tuple(dict.fromkeys(box.reference_image for box in self._boxes))

    def reference_images_of(self, class_name: str) -> tuple[ReferenceImage, ...]:
        """
        Reference images of one class, each one visual query.

        Parameters
        ----------
        class_name : str
            Class to look up.

        Returns
        -------
        tuple[ReferenceImage, ...]
            Images holding boxes of the class, in the order their first box was added.
        """
        return tuple(dict.fromkeys(box.reference_image for box in self._boxes if box.class_name == class_name))

    def pixels_of(self, reference_image: ReferenceImage) -> Image.Image:
        """
        Pixels of a reference image.

        Parameters
        ----------
        reference_image : ReferenceImage
            Image holding at least one box.

        Returns
        -------
        Image.Image
            RGB pixels given when its boxes were added.

        Raises
        ------
        KeyError
            If no box lies on the image.
        """
        if reference_image not in self._images:
            raise KeyError(f"No reference box lies on '{reference_image.name}'.")
        return self._images[reference_image]

    def boxes_of(self, class_name: str, reference_image: ReferenceImage) -> tuple[ReferenceBox, ...]:
        """
        Boxes of one class on one reference image.

        Parameters
        ----------
        class_name : str
            Class to look up.
        reference_image : ReferenceImage
            Reference image.

        Returns
        -------
        tuple[ReferenceBox, ...]
            Boxes in drawing order.
        """
        return tuple(
            box for box in self._boxes if box.class_name == class_name and box.reference_image == reference_image
        )

    def add(self, box: ReferenceBox, image: Image.Image) -> None:
        """
        Add a reference box.

        Parameters
        ----------
        box : ReferenceBox
            Box to add.
        image : Image.Image
            RGB pixels of ``box.reference_image``, kept as long as the image has boxes.

        Raises
        ------
        ValueError
            If the box does not lie inside ``image``.
        """
        self._require_inside(box, image)
        self._boxes.append(box)
        self._images[box.reference_image] = image

    def replace(self, boxes: Sequence[ReferenceBox], pixels: Mapping[ReferenceImage, Image.Image]) -> None:
        """
        Replace every box, e.g. with the boxes of a loaded class set.

        Parameters
        ----------
        boxes : Sequence[ReferenceBox]
            New boxes in drawing order.
        pixels : Mapping[ReferenceImage, Image.Image]
            RGB pixels of every image the boxes lie on; images without a box are ignored.

        Raises
        ------
        KeyError
            If the pixels of an image are missing; the board is left unchanged.
        ValueError
            If a box does not lie inside its image; the board is left unchanged.
        """
        for box in boxes:
            if box.reference_image not in pixels:
                raise KeyError(f"Pixels of the reference image '{box.reference_image.name}' are missing.")
            self._require_inside(box, pixels[box.reference_image])
        self._boxes = list(boxes)
        self._images = {box.reference_image: pixels[box.reference_image] for box in boxes}

    def remove_reference_image(self, class_name: str, reference_image: ReferenceImage) -> None:
        """
        Remove the boxes of one class on one reference image, i.e. one visual query.

        Parameters
        ----------
        class_name : str
            Class of the boxes.
        reference_image : ReferenceImage
            Reference image of the boxes.
        """
        self._boxes = [
            box for box in self._boxes if not (box.class_name == class_name and box.reference_image == reference_image)
        ]
        self._forget_unused_images()

    def move_reference_image(self, class_name: str, reference_image: ReferenceImage, target_class_name: str) -> None:
        """
        Move the boxes of one class on one reference image to another class.

        The moved image joins the reference images of the target class, merging with its boxes on the same image.

        Parameters
        ----------
        class_name : str
            Class the boxes belong to.
        reference_image : ReferenceImage
            Reference image of the boxes.
        target_class_name : str
            Class to move the boxes to.
        """
        self._boxes = [
            box.renamed(target_class_name)
            if box.class_name == class_name and box.reference_image == reference_image
            else box
            for box in self._boxes
        ]

    def clear(self) -> None:
        """
        Remove every box.
        """
        self._boxes = []
        self._forget_unused_images()

    def rename_class(self, old_name: str, new_name: str) -> None:
        """
        Move the boxes of a renamed class to its new name.

        Parameters
        ----------
        old_name : str
            Previous class name.
        new_name : str
            Current class name.
        """
        self._boxes = [box.renamed(new_name) if box.class_name == old_name else box for box in self._boxes]

    def retain_classes(self, class_names: Sequence[str]) -> None:
        """
        Remove the boxes of classes that no longer exist.

        Parameters
        ----------
        class_names : Sequence[str]
            Current class names.
        """
        kept_names: frozenset[str] = frozenset(class_names)
        self._boxes = [box for box in self._boxes if box.class_name in kept_names]
        self._forget_unused_images()

    def reference_only_classes(
        self,
        definitions: Sequence[ClassDefinition],
        supported_kinds: frozenset[QueryKind],
        exemplar_class_names: frozenset[str],
    ) -> tuple[str, ...]:
        """
        Classes queried only by reference images that the selected model cannot take.

        Parameters
        ----------
        definitions : Sequence[ClassDefinition]
            Classes to recognize.
        supported_kinds : frozenset[QueryKind]
            Query kinds the selected model accepts.
        exemplar_class_names : frozenset[str]
            Classes shown by a positive exemplar box on some picture.

        Returns
        -------
        tuple[str, ...]
            Names of classes without a phrase or usable exemplar box but with reference images, in class order;
            empty when the model accepts reference images.
        """
        if QueryKind.VISUAL in supported_kinds:
            return ()
        return tuple(
            definition.name
            for definition in definitions
            if not definition.text_queries
            and self.reference_images_of(definition.name)
            and not self._is_exemplar_queried(definition.name, supported_kinds, exemplar_class_names)
        )

    def signature_of(self, definitions: Sequence[ClassDefinition]) -> PromptSignature:
        """
        What the classes query with their phrases and every reference box, whatever the model.

        Parameters
        ----------
        definitions : Sequence[ClassDefinition]
            Classes in class-id order.

        Returns
        -------
        PromptSignature
            Phrases and reference boxes of every class; add the drawings of a picture with
            ``PromptSignature.with_drawings`` and narrow it to a model with ``PromptSignature.for_query_kinds``.
        """
        return PromptSignature(
            tuple(
                QueriedClass(
                    name=definition.name,
                    phrases=frozenset(definition.text_queries),
                    reference_boxes=frozenset(box for box in self._boxes if box.class_name == definition.name),
                )
                for definition in definitions
            )
        )

    def prompt_issue(
        self,
        definitions: Sequence[ClassDefinition],
        supported_kinds: frozenset[QueryKind],
        exemplar_class_names: frozenset[str],
    ) -> str | None:
        """
        Why no class prompt can be built from the classes, checked before ``build_classes``.

        Parameters
        ----------
        definitions : Sequence[ClassDefinition]
            Classes to recognize.
        supported_kinds : frozenset[QueryKind]
            Query kinds the selected model accepts.
        exemplar_class_names : frozenset[str]
            Classes shown by a positive exemplar box on some picture.

        Returns
        -------
        str | None
            Message for the user when there is no class or a class is left without any query the model accepts,
            ``None`` when a prompt can be built.
        """
        if not definitions:
            return "Add at least one class before running inference."
        is_visual_supported: bool = QueryKind.VISUAL in supported_kinds
        for definition in definitions:
            has_references: bool = bool(self.reference_images_of(definition.name))
            if (
                definition.text_queries
                or (is_visual_supported and has_references)
                or self._is_exemplar_queried(definition.name, supported_kinds, exemplar_class_names)
            ):
                continue
            return self._describe_missing_queries(
                definition.name,
                has_references=has_references,
                is_exemplar_supported=QueryKind.EXEMPLAR in supported_kinds,
            )
        return None

    def build_classes(
        self,
        definitions: Sequence[ClassDefinition],
        supported_kinds: frozenset[QueryKind],
        exemplar_class_names: frozenset[str],
    ) -> tuple[PromptClass, ...]:
        """
        Classes queried by their phrases and, when supported, by their reference images and exemplar boxes.

        Parameters
        ----------
        definitions : Sequence[ClassDefinition]
            Classes to recognize, in class-id order.
        supported_kinds : frozenset[QueryKind]
            Query kinds the selected model accepts; reference images are left out without ``VISUAL``.
        exemplar_class_names : frozenset[str]
            Classes shown by a positive exemplar box on some picture.

        Returns
        -------
        tuple[PromptClass, ...]
            Classes with their queries.

        Raises
        ------
        ValueError
            If ``prompt_issue`` reports an issue.
        """
        issue: str | None = self.prompt_issue(definitions, supported_kinds, exemplar_class_names)
        if issue is not None:
            raise ValueError(issue)
        is_visual_supported: bool = QueryKind.VISUAL in supported_kinds
        classes: list[PromptClass] = []
        for definition in definitions:
            visual_examples: tuple[VisualExample, ...] = (
                tuple(
                    VisualExample(
                        reference_image=reference_image,
                        boxes=tuple(box.xyxy for box in self.boxes_of(definition.name, reference_image)),
                        pixels=self._images[reference_image],
                    )
                    for reference_image in self.reference_images_of(definition.name)
                )
                if is_visual_supported
                else ()
            )
            classes.append(
                PromptClass(
                    name=definition.name,
                    phrases=definition.text_queries,
                    visual_examples=visual_examples,
                    is_exemplar_queried=self._is_exemplar_queried(
                        definition.name, supported_kinds, exemplar_class_names
                    ),
                )
            )
        return tuple(classes)

    @staticmethod
    def _is_exemplar_queried(
        class_name: str, supported_kinds: frozenset[QueryKind], exemplar_class_names: frozenset[str]
    ) -> bool:
        return QueryKind.EXEMPLAR in supported_kinds and class_name in exemplar_class_names

    @staticmethod
    def _describe_missing_queries(class_name: str, has_references: bool, is_exemplar_supported: bool) -> str:
        if has_references:
            return (
                f"'{class_name}' is queried only by reference images, which the selected model does not take. "
                + "Add a phrase to the class or choose a model that takes image prompts."
            )
        if is_exemplar_supported:
            return (
                f"'{class_name}' has no phrase and no exemplar box. "
                + "Add a phrase to the class or draw an exemplar box of it on a picture."
            )
        return f"'{class_name}' has no phrase and no reference image. Add a phrase to the class."

    @staticmethod
    def _require_inside(box: ReferenceBox, image: Image.Image) -> None:
        width, height = image.size
        if box.left < 0 or box.top < 0 or box.right > width or box.bottom > height:
            raise ValueError(f"box must lie inside the {width}x{height} image. got {box.xyxy}")

    def _forget_unused_images(self) -> None:
        used_images: frozenset[ReferenceImage] = frozenset(box.reference_image for box in self._boxes)
        self._images = {
            reference_image: image for reference_image, image in self._images.items() if reference_image in used_images
        }
