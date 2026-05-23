from __future__ import annotations

import sys

from HIServices import (
    AXIsProcessTrustedWithOptions,  # ty: ignore[unresolved-import]
    kAXTrustedCheckOptionPrompt,  # ty: ignore[unresolved-import]
)


def _request_accessibility_trust() -> bool:
    options = {kAXTrustedCheckOptionPrompt: True}
    trusted = AXIsProcessTrustedWithOptions(options)
    if not trusted:
        print(
            "[linux-virus-frontend] Accessibility permission is required. "
            "Enable the app that launched this process, such as Terminal, iTerm, or VS Code, "
            "in System Settings > Privacy & Security > Accessibility. "
            "If keyboard blocking does not work, also enable it in Input Monitoring, "
            "then restart this app.",
            file=sys.stderr,
        )
    return trusted
