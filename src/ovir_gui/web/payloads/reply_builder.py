from pathlib import Path

from ...export import ExportFormat, ExportScope
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
            Model, counts, issue, formats of the task and scopes.
        """
        return {
            "model_name": plan.profile.label,
            "options_text": plan.profile.options_text,
            "task": plan.profile.task.value,
            "picture_count": plan.picture_count,
            "pending_count": plan.pending_count,
            "issue": plan.issue,
            "formats": [
                {
                    "value": export_format.value,
                    "label": export_format.label,
                    "is_confidence_supported": export_format.is_confidence_supported,
                }
                for export_format in ExportFormat.of_task(plan.profile.task)
            ],
            "scopes": [
                {"value": scope.value, "label": scope.label, "description": scope.description} for scope in ExportScope
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
