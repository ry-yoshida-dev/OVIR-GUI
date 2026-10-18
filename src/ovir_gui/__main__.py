import sys

from .cli import CommandLine, LaunchOptions


def main() -> None:
    """
    Start the web interface; media given as arguments are opened at start, otherwise those of the last session.
    """
    options: LaunchOptions = CommandLine().parse(sys.argv[1:])
    from .web import WebLauncher

    WebLauncher(options.host, options.port, options.is_browser_opened, options.data_directory).run(options.paths)


if __name__ == "__main__":
    main()
