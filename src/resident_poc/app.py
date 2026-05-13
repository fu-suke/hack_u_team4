from __future__ import annotations

import signal
import sys

from resident_poc.controller import _ResidentAppController
from resident_poc.permissions import _request_accessibility_trust


def run() -> None:
    """
    macOS 常駐アプリ PoC を起動する。

    Args:
        なし。

    Returns:
        None: 戻り値はありません。
    """
    _request_accessibility_trust()
    app = _ResidentAppController.alloc().init()
    app.run()


def main() -> None:
    """
    コマンドラインエントリポイントとして PoC を起動する。

    Args:
        なし。

    Returns:
        None: 戻り値はありません。
    """
    signal.signal(signal.SIGINT, signal.default_int_handler)
    try:
        run()
    except KeyboardInterrupt:
        print("\n[resident-poc] stopped", file=sys.stderr)


if __name__ == "__main__":
    main()
