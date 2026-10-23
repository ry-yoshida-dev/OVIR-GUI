from collections.abc import Callable
from typing import ClassVar

from .action_reply import ActionReply
from .notice import Notice
from .workspace_observer import WorkspaceObserver
from .workspace_topic import WorkspaceTopic


class StatusNotifier:
    """
    Tells the views following the workspace what changed, and keeps the status and activity messages they show.

    Every status message is numbered, so a view can tell a repeated message from the previous one.
    """

    INITIAL_STATUS: ClassVar[str] = "Open images or videos to start."

    def __init__(self) -> None:
        self._observers: list[WorkspaceObserver] = []
        self._status_message: str = self.INITIAL_STATUS
        self._status_serial: int = 0
        self._activity_message: str = ""

    @property
    def status_message(self) -> str:
        """
        Latest status for the user.

        Returns
        -------
        str
            Message, possibly empty.
        """
        return self._status_message

    @property
    def status_serial(self) -> int:
        """
        Number of status messages posted so far.

        Returns
        -------
        int
            Counter telling a repeated message from the previous one.
        """
        return self._status_serial

    @property
    def activity_message(self) -> str:
        """
        What the worker is doing.

        Returns
        -------
        str
            E.g. the model being loaded; empty while idle.
        """
        return self._activity_message

    def add_observer(self, observer: WorkspaceObserver) -> None:
        """
        Follow the changes and notices of the workspace.

        Parameters
        ----------
        observer : WorkspaceObserver
            View to tell.
        """
        self._observers.append(observer)

    def remove_observer(self, observer: WorkspaceObserver) -> None:
        """
        Stop telling a view.

        Parameters
        ----------
        observer : WorkspaceObserver
            View added before; nothing happens otherwise.
        """
        if observer in self._observers:
            self._observers.remove(observer)

    def changed(self, *topics: WorkspaceTopic) -> None:
        """
        Tell every view which parts of the workspace changed.

        Parameters
        ----------
        *topics : WorkspaceTopic
            Changed parts.
        """
        changed_topics: frozenset[WorkspaceTopic] = frozenset(topics)
        for observer in tuple(self._observers):
            observer.on_changed(changed_topics)

    def inform(self, message: str) -> None:
        """
        Post a status message.

        Parameters
        ----------
        message : str
            Message for the user.
        """
        self._status_message = message
        self._status_serial += 1
        self.changed(WorkspaceTopic.STATE)

    def alert(self, title: str, message: str) -> None:
        """
        Post an error as status and as a notice every view shows prominently.

        Parameters
        ----------
        title : str
            What failed.
        message : str
            Error message.
        """
        self.inform(f"{title}.")
        notice: Notice = Notice.error(title, message)
        for observer in tuple(self._observers):
            observer.on_notice(notice)

    def reject(self, message: str) -> ActionReply:
        """
        Post why a request was refused.

        Parameters
        ----------
        message : str
            Reason for the user.

        Returns
        -------
        ActionReply
            Refusal with the reason.
        """
        self.inform(message)
        return ActionReply.rejected(message)

    def replace_status(self, message: str) -> None:
        """
        Replace the status without telling the views, e.g. while the workspace starts.

        Parameters
        ----------
        message : str
            Message for the user.
        """
        self._status_message = message

    def show_activity(self, message: str) -> None:
        """
        Show what the worker is doing.

        Parameters
        ----------
        message : str
            Progress message.
        """
        self._activity_message = message

    def clear_activity(self) -> None:
        """
        Show that the worker does nothing.
        """
        self._activity_message = ""

    def save_reporting_failure(self, save: Callable[[], None], failure_text: str) -> None:
        """
        Save something, posting a status instead of raising when the file cannot be written.

        Parameters
        ----------
        save : Callable[[], None]
            Writes the file; may raise ``OSError``.
        failure_text : str
            Start of the message posted on failure, followed by the error.
        """
        try:
            save()
        except OSError as error:
            self.inform(f"{failure_text}: {error}")
