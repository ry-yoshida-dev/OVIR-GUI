from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class LaunchOptions:
    """
    What the command line asks to start.

    Attributes
    ----------
    paths : tuple[Path, ...]
        Images, videos or directories opened at start; empty to open the media of the last session.
    host : str
        Interface the web server listens on.
    port : int
        Port the web server listens on.
    is_browser_opened : bool
        Whether the interface is opened in the default browser.
    data_directory : Path
        Directory keeping classes, results, uploads and the session.
    embed_origins : tuple[str, ...]
        Origins of the pages allowed to show the interface in a frame.
    access_token : str | None
        Secret of the printed address given by the environment; ``None`` creates one for the run.
    """

    paths: tuple[Path, ...]
    host: str
    port: int
    is_browser_opened: bool
    data_directory: Path
    embed_origins: tuple[str, ...] = ()
    access_token: str | None = None
