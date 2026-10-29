import sys

from .cli import CommandLine, LaunchOptions
from .ffmpeg import FFmpegStartupCheck


def main() -> None:
    """
    Start the web interface; media given as arguments are opened at start, otherwise those of the last session.

    FFmpeg is made available before the web server, and with it torchcodec, is imported.
    """
    options: LaunchOptions = CommandLine().parse(sys.argv[1:])
    FFmpegStartupCheck.of_current_process().run(options.is_ffmpeg_download_requested)
    from .web import WebLauncher

    WebLauncher(
        options.host,
        options.port,
        options.is_browser_opened,
        options.data_directory,
        options.embed_origins,
        options.access_token,
    ).run(options.paths)


if __name__ == "__main__":
    main()
