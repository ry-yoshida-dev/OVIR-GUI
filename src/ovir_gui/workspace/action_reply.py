from dataclasses import dataclass

from .action_status import ActionStatus


@dataclass(frozen=True)
class ActionReply:
    """
    Answer of the workspace to a request such as Detect, Detect All or Export.

    Attributes
    ----------
    status : ActionStatus
        Whether the request was carried out or started, refused, or waits for the user to approve skipping classes.
    message : str
        Why the request was refused or what needs approval; empty when done.
    skipped_class_names : tuple[str, ...]
        Classes queried only by reference images that the selected model cannot take, to be approved before the
        request is repeated; empty unless approval is needed.
    """

    status: ActionStatus
    message: str = ""
    skipped_class_names: tuple[str, ...] = ()

    @classmethod
    def done(cls) -> "ActionReply":
        """
        Request carried out or started.

        Returns
        -------
        ActionReply
            Reply of the ``DONE`` status.
        """
        return cls(status=ActionStatus.DONE)

    @classmethod
    def rejected(cls, message: str) -> "ActionReply":
        """
        Request refused.

        Parameters
        ----------
        message : str
            Why it was refused.

        Returns
        -------
        ActionReply
            Reply of the ``REJECTED`` status.
        """
        return cls(status=ActionStatus.REJECTED, message=message)

    @classmethod
    def needing_approval(cls, model_label: str, skipped_class_names: tuple[str, ...]) -> "ActionReply":
        """
        Request waiting for the user to approve leaving out classes the model cannot query.

        Parameters
        ----------
        model_label : str
            Name of the model that cannot take reference images.
        skipped_class_names : tuple[str, ...]
            Classes queried only by reference images.

        Returns
        -------
        ActionReply
            Reply of the ``NEEDS_APPROVAL`` status.
        """
        return cls(
            status=ActionStatus.NEEDS_APPROVAL,
            message=f"{model_label} does not take reference images, so these classes have no usable query: "
            + f"{', '.join(skipped_class_names)}. Infer the other classes without them?",
            skipped_class_names=skipped_class_names,
        )
