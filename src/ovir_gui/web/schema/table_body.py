from pydantic import BaseModel

from .finding_reference import FindingReference


class TableBody(BaseModel):
    """
    Findings listed by the result table, in display order.

    Attributes
    ----------
    findings : list[FindingReference]
        Listed findings.
    """

    findings: list[FindingReference]
