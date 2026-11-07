from collections.abc import Iterable
from dataclasses import dataclass
from typing import ClassVar
from urllib.parse import SplitResult, urlsplit


@dataclass(frozen=True)
class EmbeddingPolicy:
    """
    Pages of other applications allowed to show the user interface in a frame and to drive it with ``postMessage``.

    Browsers refuse to show the interface inside a page of an origin not listed here, so other sites cannot overlay it
    to trick the user into clicks. Without parent origins only pages of the server itself may frame it.

    Attributes
    ----------
    parent_origins : tuple[str, ...]
        Origins such as ``http://localhost:3000``, normalized to lower-case scheme and host without a trailing slash.

    Raises
    ------
    ValueError
        If an origin is not ``http`` or ``https`` with a host and nothing after the port.
    """

    SCHEMES: ClassVar[frozenset[str]] = frozenset({"http", "https"})

    parent_origins: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "parent_origins", tuple(dict.fromkeys(self.normalized(origin) for origin in self.parent_origins))
        )

    @classmethod
    def of(cls, origins: Iterable[str]) -> "EmbeddingPolicy":
        """
        Policy allowing the given parent origins.

        Parameters
        ----------
        origins : Iterable[str]
            Origins of the pages embedding the interface.

        Returns
        -------
        EmbeddingPolicy
            Policy with the normalized origins, each once.
        """
        return cls(parent_origins=tuple(origins))

    @property
    def is_embedding_allowed(self) -> bool:
        """
        Whether a page of another origin may frame the interface.

        Returns
        -------
        bool
            True when at least one parent origin is allowed.
        """
        return bool(self.parent_origins)

    @property
    def content_security_policy(self) -> str:
        """
        ``Content-Security-Policy`` header value limiting who may frame the interface.

        Returns
        -------
        str
            ``frame-ancestors`` directive naming the server itself and every parent origin.
        """
        return " ".join(("frame-ancestors", "'self'", *self.parent_origins))

    @classmethod
    def normalized(cls, origin: str) -> str:
        """
        Check and normalize one origin.

        Parameters
        ----------
        origin : str
            Origin such as ``http://localhost:3000``.

        Returns
        -------
        str
            ``<scheme>://<host>[:<port>]`` in lower case.

        Raises
        ------
        ValueError
            If the origin is not ``http`` or ``https`` with a host and nothing after the port.
        """
        parts: SplitResult = urlsplit(origin.strip())
        if parts.scheme.lower() not in cls.SCHEMES or not parts.hostname:
            raise ValueError(f"an embedding origin needs an http or https scheme and a host. got {origin!r}")
        if parts.path not in {"", "/"} or parts.query or parts.fragment or parts.username or parts.password:
            raise ValueError(f"an embedding origin is only scheme, host and port. got {origin!r}")
        return f"{parts.scheme.lower()}://{parts.netloc.lower()}"
