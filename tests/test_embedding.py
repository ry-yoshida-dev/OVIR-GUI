import pytest

from ovir_gui.cli import CommandLine, LaunchOptions
from ovir_gui.web import EmbeddingPolicy

TOKEN = "0123456789abcdef-token"


class TestEmbeddingPolicy:
    """
    Embedding origins are normalized and checked, and limit framing through ``frame-ancestors``.
    """

    def test_origins_are_normalized_once(self) -> None:
        policy: EmbeddingPolicy = EmbeddingPolicy.of(["HTTP://LocalHost:3000/", "http://localhost:3000"])
        assert policy.parent_origins == ("http://localhost:3000",)
        assert policy.is_embedding_allowed
        assert policy.content_security_policy == "frame-ancestors 'self' http://localhost:3000"

    def test_without_origins_only_the_server_frames_itself(self) -> None:
        policy: EmbeddingPolicy = EmbeddingPolicy()
        assert not policy.is_embedding_allowed
        assert policy.content_security_policy == "frame-ancestors 'self'"

    @pytest.mark.parametrize(
        "origin",
        ["localhost:3000", "ftp://localhost", "http://localhost:3000/app", "http://localhost?x=1", "http://"],
    )
    def test_invalid_origins_are_refused(self, origin: str) -> None:
        with pytest.raises(ValueError):
            EmbeddingPolicy.of([origin])


class TestCommandLineEmbedding:
    """
    Embedding origins come from repeated ``--embed-origin`` options and a fixed token from ``OVIR_GUI_TOKEN``.
    """

    def test_origins_and_token_are_read(self) -> None:
        options: LaunchOptions = CommandLine().parse(
            ["--embed-origin", "http://localhost:3000", "--embed-origin", "http://localhost:5173"],
            {CommandLine.TOKEN_VARIABLE: f"  {TOKEN}  "},
        )
        assert options.embed_origins == ("http://localhost:3000", "http://localhost:5173")
        assert options.access_token == TOKEN

    def test_without_token_one_is_created_later(self) -> None:
        options: LaunchOptions = CommandLine().parse([], {})
        assert options.embed_origins == ()
        assert options.access_token is None

    def test_short_token_is_refused(self) -> None:
        with pytest.raises(SystemExit):
            _ = CommandLine().parse([], {CommandLine.TOKEN_VARIABLE: "short"})
