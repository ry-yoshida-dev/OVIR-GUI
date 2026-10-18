from dataclasses import dataclass


@dataclass(frozen=True)
class RunProgress:
    """
    Progress of the running foreground job.

    Attributes
    ----------
    title : str
        Name of the job, e.g. ``"Run All"``.
    processed_count : int
        Pictures handed back so far.
    total_count : int
        Pictures of the job.
    is_blocking : bool
        Whether the interface shows a modal progress.
    """

    title: str
    processed_count: int
    total_count: int
    is_blocking: bool
