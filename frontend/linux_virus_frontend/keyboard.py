from __future__ import annotations

from typing import Any

from AppKit import (
    NSEventModifierFlagControl,  # ty: ignore[unresolved-import]
    NSEventModifierFlagOption,  # ty: ignore[unresolved-import]
)

_V_KEY_CODE = 9
QUIT_KEY_CODE = 12
RECOVER_VACCINE_KEY_CODE = 13


class _KeyboardInterpreter:
    def is_virus_hotkey(self, event: Any) -> bool:
        key_code = event.keyCode()
        flags = event.modifierFlags()
        has_control = bool(flags & NSEventModifierFlagControl)
        has_option = bool(flags & NSEventModifierFlagOption)
        return key_code == _V_KEY_CODE and has_control and has_option

    def is_quit_hotkey(self, event: Any) -> bool:
        key_code = event.keyCode()
        flags = event.modifierFlags()
        has_control = bool(flags & NSEventModifierFlagControl)
        has_option = bool(flags & NSEventModifierFlagOption)
        return key_code == QUIT_KEY_CODE and has_control and has_option

    def is_recover_vaccine_hotkey(self, event: Any) -> bool:
        key_code = event.keyCode()
        flags = event.modifierFlags()
        has_control = bool(flags & NSEventModifierFlagControl)
        has_option = bool(flags & NSEventModifierFlagOption)
        return key_code == RECOVER_VACCINE_KEY_CODE and has_control and has_option
