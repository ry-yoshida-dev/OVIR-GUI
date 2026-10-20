from typing import ClassVar

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .connection_kind import ConnectionKind
from .embedding_policy import EmbeddingPolicy


class FramingHeaders:
    """
    ASGI middleware telling browsers which pages may show the user interface in a frame.

    Every HTTP response carries the ``Content-Security-Policy`` ``frame-ancestors`` directive of the embedding policy,
    including refusals, so no page of an origin outside the policy can frame any part of the server.
    """

    HEADER_NAME: ClassVar[str] = "Content-Security-Policy"

    def __init__(self, application: ASGIApp, policy: EmbeddingPolicy) -> None:
        """
        Parameters
        ----------
        application : ASGIApp
            Application whose responses get the header.
        policy : EmbeddingPolicy
            Origins allowed to frame the interface.
        """
        self._application: ASGIApp = application
        self._header_value: str = policy.content_security_policy

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        """
        Pass the connection on, adding the header to the start of every HTTP response.

        Parameters
        ----------
        scope : Scope
            ASGI connection scope.
        receive : Receive
            ASGI receive channel.
        send : Send
            ASGI send channel.
        """
        if ConnectionKind(scope["type"]) is not ConnectionKind.HTTP:
            await self._application(scope, receive, send)
            return

        async def send_with_header(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers: MutableHeaders = MutableHeaders(scope=message)
                headers[self.HEADER_NAME] = self._header_value
            await send(message)

        await self._application(scope, receive, send_with_header)
