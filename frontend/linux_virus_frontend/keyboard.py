from __future__ import annotations

from typing import Any

from AppKit import (
    NSEventModifierFlagCommand,  # ty: ignore[unresolved-import]
    NSEventModifierFlagControl,  # ty: ignore[unresolved-import]
    NSEventModifierFlagOption,  # ty: ignore[unresolved-import]
    NSEventModifierFlagShift,  # ty: ignore[unresolved-import]
)

from linux_virus_frontend.config import Q_KEY_CODE, SPACE_KEY_CODE, SPECIAL_KEY_LABELS


class _KeyboardInterpreter:
    def is_toggle_hotkey(self, event: Any) -> bool:
        key_code = event.keyCode()
        flags = event.modifierFlags()
        has_control = bool(flags & NSEventModifierFlagControl)
        has_option = bool(flags & NSEventModifierFlagOption)
        return key_code == SPACE_KEY_CODE and has_control and has_option

    def is_quit_hotkey(self, event: Any) -> bool:
        key_code = event.keyCode()
        flags = event.modifierFlags()
        has_control = bool(flags & NSEventModifierFlagControl)
        has_option = bool(flags & NSEventModifierFlagOption)
        return key_code == Q_KEY_CODE and has_control and has_option

    def format_key(self, event: Any) -> str:
        combo = self._format_modifier_combo(event)
        if combo:
            return combo

        characters = event.charactersIgnoringModifiers()
        if characters:
            return str(characters)
        return ""

    def _format_modifier_combo(self, event: Any) -> str:
        flags = event.modifierFlags()
        parts = []
        if flags & NSEventModifierFlagCommand:
            parts.append("cmd")
        if flags & NSEventModifierFlagControl:
            parts.append("ctrl")
        if flags & NSEventModifierFlagOption:
            parts.append("option")
        if flags & NSEventModifierFlagShift:
            parts.append("shift")

        if not parts:
            return ""

        key_label = self._format_key_without_modifiers(event)
        if not key_label:
            return ""
        return f"<{'+'.join(parts)}>+{key_label}"

    def _format_key_without_modifiers(self, event: Any) -> str:
        key_code = event.keyCode()
        if key_code in SPECIAL_KEY_LABELS:
            return SPECIAL_KEY_LABELS[key_code]

        characters = event.charactersIgnoringModifiers()
        if characters:
            return str(characters).lower()
        return f"<key:{key_code}>"
