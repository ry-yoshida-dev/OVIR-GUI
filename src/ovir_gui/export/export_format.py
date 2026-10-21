from enum import Enum

from object_detection_format import AnnotationFormat as BoxAnnotationFormat
from segmentation_format import AnnotationFormat as MaskAnnotationFormat

from ..recognition import RecognitionTask


class ExportFormat(Enum):
    """
    File format results are exported to.

    Attributes
    ----------
    CSV : str
        One table: a row per finding, or per picture with every class score for classification.
    JSON : str
        One document with every picture and its findings, scores and mask outlines.
    COCO : str
        MS COCO boxes.
    YOLO : str
        YOLO boxes, one text file per picture.
    PASCAL_VOC : str
        Pascal VOC boxes, one XML file per picture.
    LABELME : str
        LabelMe rectangles, one JSON file per picture.
    CREATE_ML : str
        Create ML boxes.
    COCO_SEGMENTATION : str
        MS COCO instance segmentation with polygon outlines.
    YOLO_SEGMENTATION : str
        YOLO segmentation polygons of the largest region of every mask, one text file per picture.
    LABELME_SEGMENTATION : str
        LabelMe polygons, one JSON file per picture.
    MASK_PNG : str
        Instance and class label maps as PNG images.
    CLASS_FOLDERS : str
        Pictures copied into one folder per predicted class.
    """

    CSV = "csv"
    JSON = "json"
    COCO = "coco"
    YOLO = "yolo"
    PASCAL_VOC = "pascal_voc"
    LABELME = "labelme"
    CREATE_ML = "create_ml"
    COCO_SEGMENTATION = "coco_segmentation"
    YOLO_SEGMENTATION = "yolo_segmentation"
    LABELME_SEGMENTATION = "labelme_segmentation"
    MASK_PNG = "mask_png"
    CLASS_FOLDERS = "class_folders"

    @property
    def label(self) -> str:
        """
        Name shown to the user.

        Returns
        -------
        str
            E.g. ``"MS COCO (JSON)"``.
        """
        match self:
            case ExportFormat.CSV:
                return "CSV table"
            case ExportFormat.JSON:
                return "JSON document"
            case ExportFormat.COCO:
                return "MS COCO boxes (JSON)"
            case ExportFormat.YOLO:
                return "YOLO boxes (TXT)"
            case ExportFormat.PASCAL_VOC:
                return "Pascal VOC (XML)"
            case ExportFormat.LABELME:
                return "LabelMe rectangles (JSON)"
            case ExportFormat.CREATE_ML:
                return "Create ML (JSON)"
            case ExportFormat.COCO_SEGMENTATION:
                return "MS COCO segmentation (JSON)"
            case ExportFormat.YOLO_SEGMENTATION:
                return "YOLO segmentation (TXT)"
            case ExportFormat.LABELME_SEGMENTATION:
                return "LabelMe polygons (JSON)"
            case ExportFormat.MASK_PNG:
                return "Mask images (PNG)"
            case ExportFormat.CLASS_FOLDERS:
                return "Folder per class"

    @property
    def tasks(self) -> frozenset[RecognitionTask]:
        """
        Tasks whose results the format can hold.

        Returns
        -------
        frozenset[RecognitionTask]
            Supported tasks.
        """
        match self:
            case ExportFormat.CSV | ExportFormat.JSON:
                return frozenset(RecognitionTask)
            case (
                ExportFormat.COCO
                | ExportFormat.YOLO
                | ExportFormat.PASCAL_VOC
                | ExportFormat.LABELME
                | ExportFormat.CREATE_ML
            ):
                return frozenset({RecognitionTask.DETECTION, RecognitionTask.SEGMENTATION})
            case (
                ExportFormat.COCO_SEGMENTATION
                | ExportFormat.YOLO_SEGMENTATION
                | ExportFormat.LABELME_SEGMENTATION
                | ExportFormat.MASK_PNG
            ):
                return frozenset({RecognitionTask.SEGMENTATION})
            case ExportFormat.CLASS_FOLDERS:
                return frozenset({RecognitionTask.CLASSIFICATION})

    @property
    def is_confidence_supported(self) -> bool:
        """
        Whether the format can carry confidences.

        Returns
        -------
        bool
            True for tables, COCO and YOLO.
        """
        match self:
            case (
                ExportFormat.CSV
                | ExportFormat.JSON
                | ExportFormat.COCO
                | ExportFormat.YOLO
                | ExportFormat.COCO_SEGMENTATION
                | ExportFormat.YOLO_SEGMENTATION
            ):
                return True
            case _:
                return False

    @property
    def needs_picture_files(self) -> bool:
        """
        Whether the format refers to picture files, so video frames are saved as images first.

        Returns
        -------
        bool
            True for every annotation format and class folders.
        """
        match self:
            case ExportFormat.CSV | ExportFormat.JSON:
                return False
            case _:
                return True

    @property
    def box_annotation_format(self) -> BoxAnnotationFormat | None:
        """
        Box format of ``object_detection_format`` writing this format.

        Returns
        -------
        BoxAnnotationFormat | None
            ``None`` for formats that are not box formats.
        """
        match self:
            case ExportFormat.COCO:
                return BoxAnnotationFormat.COCO
            case ExportFormat.YOLO:
                return BoxAnnotationFormat.YOLO
            case ExportFormat.PASCAL_VOC:
                return BoxAnnotationFormat.PASCAL_VOC
            case ExportFormat.LABELME:
                return BoxAnnotationFormat.LABELME
            case ExportFormat.CREATE_ML:
                return BoxAnnotationFormat.CREATEML
            case _:
                return None

    @property
    def mask_annotation_format(self) -> MaskAnnotationFormat | None:
        """
        Mask format of ``segmentation_format`` writing this format.

        Returns
        -------
        MaskAnnotationFormat | None
            ``None`` for formats that are not mask formats of ``segmentation_format``.
        """
        match self:
            case ExportFormat.COCO_SEGMENTATION:
                return MaskAnnotationFormat.COCO
            case ExportFormat.YOLO_SEGMENTATION:
                return MaskAnnotationFormat.YOLO
            case ExportFormat.LABELME_SEGMENTATION:
                return MaskAnnotationFormat.LABELME
            case _:
                return None

    @classmethod
    def of_task(cls, task: RecognitionTask) -> tuple["ExportFormat", ...]:
        """
        Formats offered for a task.

        Parameters
        ----------
        task : RecognitionTask
            Task of the exported results.

        Returns
        -------
        tuple[ExportFormat, ...]
            Formats in declaration order.
        """
        return tuple(export_format for export_format in cls if task in export_format.tasks)
