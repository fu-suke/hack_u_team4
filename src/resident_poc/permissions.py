from __future__ import annotations

import sys

from HIServices import AXIsProcessTrustedWithOptions, kAXTrustedCheckOptionPrompt


def _request_accessibility_trust() -> bool:
    options = {kAXTrustedCheckOptionPrompt: True}
    trusted = AXIsProcessTrustedWithOptions(options)
    if not trusted:
        print(
            "[resident-poc] Accessibility permission is required. "
            "Enable the app that launched this process, such as Terminal, iTerm, or VS Code, "
            "in System Settings > Privacy & Security > Accessibility, then restart this app.",
            file=sys.stderr,
        )
    return trusted
