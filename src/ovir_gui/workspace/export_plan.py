from dataclasses import dataclass

from ..export import ExportScope
from ..models import ModelProfile
from .export_request import ExportRequest


@dataclass(frozen=True)
class ExportPlan:
    """
    What an export would write now.

    Attributes
    ----------
    profile : ModelProfile
        Profile whose results are exported.
    picture_count : int
        Pictures with a result of the profile.
    pending_count : int
        Expected pictures recognized first because they lack an up-to-date result.
    issue : str
        Why the export cannot start; empty when it can.
    """

    profile: ModelProfile
    picture_count: int
    pending_count: int
    issue: str

    def issue_for(self, request: ExportRequest) -> str:
        """
        Why a chosen export cannot start.

        Parameters
        ----------
        request : ExportRequest
            Options chosen by the user.

        Returns
        -------
        str
            The issue of the plan, or why only listed findings cannot be exported yet; empty when it can start.
        """
        if self.issue:
            return self.issue
        if request.options.scope is ExportScope.LISTED and self.pending_count:
            return (
                f"Only listed findings can be exported once inference has run on every picture; {self.pending_count} "
                + "pictures have no up-to-date result. Infer All first, or export every kept finding."
            )
        return ""
