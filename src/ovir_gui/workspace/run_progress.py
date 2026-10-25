from dataclasses import dataclass


@dataclass(frozen=True)
class RunProgress:
    """
    Progress of a running job.

    Attributes
    ----------
    title : str
        Name of the job, e.g. ``"Infer All"``.
    processed_count : int
        Pictures handed back so far.
    total_count : int
        Pictures of the job.
    """

    title: str
    processed_count: int
    total_count: int
