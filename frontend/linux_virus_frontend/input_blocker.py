from __future__ import annotations

import sys
from typing import TYPE_CHECKING, Any, cast

import CoreFoundation
import Quartz
from AppKit import (
    NSEvent,  # ty: ignore[unresolved-import]
    NSPointInRect,  # ty: ignore[unresolved-import]
)
from PyObjCTools import AppHelper

from linux_virus_frontend.keyboard import QUIT_KEY_CODE, RECOVER_VACCINE_KEY_CODE

if TYPE_CHECKING:
    from linux_virus_frontend.controller import _ResidentAppController

_CoreFoundation = cast(Any, CoreFoundation)
_Quartz = cast(Any, Quartz)

_MOUSE_DOWN_TYPES = (
    _Quartz.kCGEventLeftMouseDown,
    _Quartz.kCGEventRightMouseDown,
    _Quartz.kCGEventOtherMouseDown,
)
_TAP_DISABLED_TYPES = (
    _Quartz.kCGEventTapDisabledByTimeout,
    _Quartz.kCGEventTapDisabledByUserInput,
)
_HOTKEY_MODIFIER_MASK = (
    _Quartz.kCGEventFlagMaskCommand
    | _Quartz.kCGEventFlagMaskControl
    | _Quartz.kCGEventFlagMaskAlternate
)

_SCREENSHOT_KEY_CODES = (21, 23)  # 数字キーの 4, 5


def _has_hotkey_modifier(event: object) -> bool:
    flags = _Quartz.CGEventGetFlags(event)
    return bool(flags & _HOTKEY_MODIFIER_MASK)


def _is_ctrl_option_event(event: object, expected_key_code: int) -> bool:
    key_code = _Quartz.CGEventGetIntegerValueField(
        event,
        _Quartz.kCGKeyboardEventKeycode,
    )
    flags = _Quartz.CGEventGetFlags(event)
    has_control = bool(flags & _Quartz.kCGEventFlagMaskControl)
    has_option = bool(flags & _Quartz.kCGEventFlagMaskAlternate)
    return key_code == expected_key_code and has_control and has_option


def _is_quit_event(event: object) -> bool:
    return _is_ctrl_option_event(event, QUIT_KEY_CODE)


def _is_recover_vaccine_event(event: object) -> bool:
    return _is_ctrl_option_event(event, RECOVER_VACCINE_KEY_CODE)


def _is_screenshot_event(event: object) -> bool:
    key_code = _Quartz.CGEventGetIntegerValueField(
        event,
        _Quartz.kCGKeyboardEventKeycode,
    )
    flags = _Quartz.CGEventGetFlags(event)
    has_command = bool(flags & _Quartz.kCGEventFlagMaskCommand)
    has_shift = bool(flags & _Quartz.kCGEventFlagMaskShift)
    return key_code in _SCREENSHOT_KEY_CODES and has_command and has_shift


class _InputBlocker:
    """`CGEventTap` を用いた入力ブロック層。

    キーボードショートカットおよびクイズ窓外のマウスダウンを必要に応じて消費し、
    開発用ホットキー (Ctrl+Option+Q / W) を最優先で拾う。
    """

    def __init__(self, controller: _ResidentAppController) -> None:
        self._controller = controller
        self._tap: object | None = None
        self._source: object | None = None

    def start(self) -> None:
        if self._tap is not None:
            return

        event_mask = _Quartz.CGEventMaskBit(_Quartz.kCGEventKeyDown)
        for mouse_type in _MOUSE_DOWN_TYPES:
            event_mask |= _Quartz.CGEventMaskBit(mouse_type)

        self._tap = _Quartz.CGEventTapCreate(
            _Quartz.kCGSessionEventTap,
            _Quartz.kCGHeadInsertEventTap,
            _Quartz.kCGEventTapOptionDefault,
            event_mask,
            self._callback,
            None,
        )
        if self._tap is None:
            print(
                "[linux-virus-frontend] keyboard event tap could not be created. "
                "Check Accessibility/Input Monitoring permissions.",
                file=sys.stderr,
            )
            return

        self._source = _CoreFoundation.CFMachPortCreateRunLoopSource(None, self._tap, 0)
        _CoreFoundation.CFRunLoopAddSource(
            _CoreFoundation.CFRunLoopGetCurrent(),
            self._source,
            _CoreFoundation.kCFRunLoopCommonModes,
        )
        _Quartz.CGEventTapEnable(self._tap, True)

    def stop(self) -> None:
        if self._tap is not None:
            _Quartz.CGEventTapEnable(self._tap, False)
        self._tap = None
        self._source = None

    def _callback(
        self,
        _proxy: object,
        event_type: int,
        event: object,
        _refcon: object,
    ) -> object | None:
        if event_type in _TAP_DISABLED_TYPES:
            if self._tap is not None:
                _Quartz.CGEventTapEnable(self._tap, True)
            return event

        if event_type in _MOUSE_DOWN_TYPES:
            return self._handle_mouse_down(event)

        if _is_quit_event(event):
            AppHelper.callAfter(self._controller.shutdown)
            return None

        if _is_recover_vaccine_event(event):
            AppHelper.callAfter(self._controller.recover_vaccines)
            return None

        if not self._controller._is_blocking_input():
            return event

        if _is_screenshot_event(event):
            return event

        if _has_hotkey_modifier(event):
            return None

        if self._controller._frontmost_app_is_self():
            return event

        AppHelper.callAfter(self._controller._refocus_blocking_window)
        return None

    def _handle_mouse_down(self, event: object) -> object | None:
        if not self._controller._is_blocking_input():
            return event
        if self._mouse_location_in_app_windows():
            return event
        AppHelper.callAfter(self._controller._refocus_blocking_window)
        return None

    def _mouse_location_in_app_windows(self) -> bool:
        location = NSEvent.mouseLocation()
        for window in (self._controller._window, self._controller._virus_window):
            if window is not None and NSPointInRect(location, window.frame()):
                return True
        return False
