from enum import Enum


class WorkspaceTopic(Enum):
    """
    Part of the workspace a view shows, reported when it changes.

    Attributes
    ----------
    STATE : str
        Media, models, classes, status and the shown picture.
    RESULTS : str
        Results of the shown profile.
    CLASS_SETS : str
        Saved class sets.
    """

    STATE = "state"
    RESULTS = "results"
    CLASS_SETS = "class_sets"
