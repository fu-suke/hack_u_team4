from __future__ import annotations

import signal
import sys

from AppKit import NSApp  # ty: ignore[unresolved-import]
from PyObjCTools import AppHelper

from linux_virus_frontend.controller import _ResidentAppController
from linux_virus_frontend.permissions import _request_accessibility_trust


def _sigint_handler(_sig: int, _frame: object) -> None:
    print("\n[linux-virus-frontend] stopped", file=sys.stderr)
    AppHelper.callAfter(NSApp.terminate_, None)


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
    signal.signal(signal.SIGINT, _sigint_handler)
    app.run()


def main() -> None:
    """
    コマンドラインエントリポイントとして PoC を起動する。

    Args:
        なし。

    Returns:
        None: 戻り値はありません。
    """
    run()


if __name__ == "__main__":
    main()
