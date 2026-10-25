from pathlib import Path

from ...export import CropImageFormat, ExportFormat, ExportPurpose
from ...workspace import ActionReply, ExportPlan
from ..json_value import JsonObject, JsonValue


class ReplyBuilder:
    """
    JSON answers to requests: the outcome of an action and what an export would write.
    """

    @staticmethod
    def export_plan(plan: ExportPlan, default_directory: Path) -> JsonObject:
        """
        What an export would write, with the choices of the export dialog.

        Parameters
        ----------
        plan : ExportPlan
            Profile and counts.
        default_directory : Path
            Output directory suggested to the user.

        Returns
        -------
        JsonObject
            Model, media kind, counts, issue, purposes and formats of the task and image formats of cropped objects.
        """
        formats: tuple[ExportFormat, ...] = ExportFormat.of_task(plan.profile.task)
        return {
            "model_name": plan.profile.label,
            "options_text": plan.profile.options_text,
            "task": plan.profile.task.value,
            "picture_count": plan.picture_count,
            "media": plan.media_kind.value,
            "pending_count": plan.pending_count,
            "is_pending_inferable": plan.is_pending_inferable,
            "issue": plan.issue,
            "formats": [
                {
                    "value": export_format.value,
                    "label": export_format.label,
                    "is_confidence_supported": export_format.is_confidence_supported,
                    "purpose": export_format.purpose.value,
                    "group_label": export_format.group_label,
                }
                for export_format in formats
            ],
            "purposes": [
                {"value": purpose.value, "label": purpose.label, "description": purpose.description}
                for purpose in ExportPurpose
                if any(export_format.purpose is purpose for export_format in formats)
            ],
            "crop_image_formats": [
                {"value": image_format.value, "label": image_format.label} for image_format in CropImageFormat
            ],
            "default_directory": str(default_directory),
        }

    @staticmethod
    def reply(reply: ActionReply) -> JsonObject:
        """
        Answer to a request.

        Parameters
        ----------
        reply : ActionReply
            Answer of the workspace.

        Returns
        -------
        JsonObject
            Status, message and the classes to approve skipping.
        """
        skipped: list[JsonValue] = list(reply.skipped_class_names)
        return {"status": reply.status.value, "message": reply.message, "skipped_class_names": skipped}
