from __future__ import annotations

import json
import queue
import sys
import time
from collections.abc import Mapping
from typing import Any

from AppKit import (
    NSApp,  # ty: ignore[unresolved-import]
    NSApplication,  # ty: ignore[unresolved-import]
    NSApplicationActivationPolicyAccessory,  # ty: ignore[unresolved-import]
    NSEvent,  # ty: ignore[unresolved-import]
    NSEventMaskKeyDown,  # ty: ignore[unresolved-import]
    NSWindow,  # ty: ignore[unresolved-import]
)
from Foundation import (
    NSObject,  # ty: ignore[unresolved-import]
    NSTimer,  # ty: ignore[unresolved-import]
)
from objc import python_method
from objc import super as objc_super  # ty: ignore[unresolved-import]
from PyObjCTools import AppHelper
from WebKit import WKWebView  # ty: ignore[unresolved-import]

from linux_virus_frontend.config import (
    EXPANDED_SIZE,
    MINIMIZED_SIZE,
    POLL_INTERVAL_SECONDS,
    SETTINGS_SIZE,
    TIMER_INTERVAL_SECONDS,
    VIRUS_POLL_INTERVAL_MINUTES,
)
from linux_virus_frontend.events import _ControlEvent, _KeyEvent
from linux_virus_frontend.keyboard import _KeyboardInterpreter
from linux_virus_frontend.mac_window import _build_overlay, _build_web_window, _top_right_frame
from linux_virus_frontend.state import _ResidentState
from linux_virus_frontend.web_bridge import _ScriptMessageHandler

_WINDOW_TITLE = "Linux Virus"
_SLEEPING_WINDOW_TITLE = "Linux Virus (sleeping)"
_VIRUS_WINDOW_TITLE = "Linux Virus Infection"


class _ResidentAppController(NSObject):
    def init(self) -> _ResidentAppController:
        self = objc_super(_ResidentAppController, self).init()
        self._events: queue.Queue[_KeyEvent | _ControlEvent] = queue.Queue()
        self._keyboard = _KeyboardInterpreter()
        self._state = _ResidentState()
        self._global_monitor: object | None = None
        self._local_monitor: object | None = None
        self._window: NSWindow | None = None
        self._overlay: NSWindow | None = None
        self._webview: WKWebView | None = None
        self._message_handler: _ScriptMessageHandler | None = None
        self._virus_window: NSWindow | None = None
        self._virus_webview: WKWebView | None = None
        self._virus_message_handler: _ScriptMessageHandler | None = None
        self._virus_deadline: float | None = None
        return self

    @python_method
    def build_window(self) -> None:
        width, height = MINIMIZED_SIZE
        self._window, self._webview, self._message_handler = _build_web_window(
            self,
            width,
            height,
        )
        self._overlay = _build_overlay()
        self._window.makeKeyAndOrderFront_(None)
        self._send_state_to_web()

    def windowWillClose_(self, notification: Any) -> None:
        if self._virus_window is not None and notification.object() == self._virus_window:
            self._clear_virus_window()
            return
        self.shutdown()

    def pollEvents_(self, _timer: NSTimer) -> None:
        self._drain_events()

    def tickTimer_(self, _timer: NSTimer) -> None:
        self._tick_timer()

    @python_method
    def handle_script_message(self, body: Any) -> None:
        message = self._normalize_script_message(body)
        if message is None:
            return

        action = str(message.get("action", ""))
        if action == "showSettings":
            self.show_settings_window()
        if action == "showUser":
            self.show_user_window()
        if action == "minimize":
            self.minimize_window()
        if action == "expand":
            self.expand_window("web")
        if action == "quit":
            self.shutdown()
        if action == "setTimer":
            self._set_timer_from_message(message)
        if action == "closeVirus":
            self.close_virus_window()

    @python_method
    def _normalize_script_message(self, body: Any) -> dict[str, Any] | None:
        if isinstance(body, Mapping):
            return dict(body)

        try:
            return dict(body)
        except (TypeError, ValueError):
            print(f"[resident-poc] ignored script message body={body!r}", file=sys.stderr)
            return None

    @python_method
    def expand_window(self, reason: str) -> None:
        self._state.disable_timer()
        self._state.view = "expanded"
        self._sync_overlay_visibility()
        self._resize_window(*EXPANDED_SIZE)
        print(f"[resident-poc] expanded reason={reason}", flush=True)
        self._send_state_to_web(status=f"Expanded by {reason}")

    @python_method
    def show_settings_window(self) -> None:
        self._state.suspend_timer_for_settings()
        self._state.view = "settings"
        self._resize_window(*SETTINGS_SIZE)
        print("[resident-poc] settings", flush=True)
        self._send_state_to_web(status="Settings")

    @python_method
    def show_user_window(self) -> None:
        self._state.suspend_timer_for_settings()
        self._state.view = "user"
        self._resize_window(*SETTINGS_SIZE)
        print("[resident-poc] user", flush=True)
        self._send_state_to_web(status="User")

    @python_method
    def minimize_window(self) -> None:
        self._state.view = "minimized"
        if (
            self._state.suspended_timer_seconds is not None
            or self._state.suspended_sleep_seconds is not None
        ):
            self._state.resume_suspended_timer()
        elif self._state.deadline is None and self._state.sleep_deadline is None:
            self._state.restart_timer()
        self._sync_overlay_visibility()
        self._resize_window(*MINIMIZED_SIZE)
        print("[resident-poc] minimized", flush=True)
        self._send_state_to_web()

    @python_method
    def _resize_window(self, width: float, height: float) -> None:
        if self._window is None:
            return

        self._window.setFrame_display_(_top_right_frame(width, height), True)
        self._window.makeKeyAndOrderFront_(None)

    @python_method
    def _set_timer_from_message(self, body: dict[Any, Any]) -> None:
        commands_text = self._state.set_timer_from_message(body)
        status = f"Timer set: {self._state.timer_seconds}s, commands: {commands_text}"
        self._send_state_to_web(status=status)
        print(
            f"[resident-poc] timer_set seconds={self._state.timer_seconds} "
            f"commands={commands_text}",
            flush=True,
        )
        self.minimize_window()

    @python_method
    def _tick_timer(self) -> None:
        if self._state.view == "minimized":
            self._send_state_to_web()
        if self._state.tick_timer_expired():
            self._events.put(_ControlEvent(name="expand", reason="timer"))
        self._tick_virus_timer()

    @python_method
    def _send_state_to_web(self, status: str | None = None) -> None:
        if self._webview is None:
            return

        self._update_window_title()
        payload = self._state.payload(status)
        script = f"window.residentSetState({json.dumps(payload)});"
        self._webview.evaluateJavaScript_completionHandler_(script, None)

    @python_method
    def _send_virus_state_to_web(self) -> None:
        if self._virus_webview is None:
            return

        payload = self._state.payload("Infection")
        payload["state"] = "expanded"
        payload["quizMode"] = "virus"
        script = f"window.residentSetState({json.dumps(payload)});"
        self._virus_webview.evaluateJavaScript_completionHandler_(script, None)

    @python_method
    def _tick_virus_timer(self) -> None:
        if self._state.is_sleeping_or_suspended_sleep():
            self._restart_virus_timer()
            return

        if self._virus_window is not None:
            self._send_virus_state_to_web()
            return

        if self._virus_deadline is None:
            self._restart_virus_timer()
            return

        if time.monotonic() < self._virus_deadline:
            return

        self.show_virus_window()

    @python_method
    def _restart_virus_timer(self) -> None:
        self._virus_deadline = time.monotonic() + VIRUS_POLL_INTERVAL_MINUTES * 60

    @python_method
    def show_virus_window(self) -> None:
        if self._virus_window is not None:
            self._sync_overlay_visibility()
            self._virus_window.makeKeyAndOrderFront_(None)
            self._send_virus_state_to_web()
            return

        self._virus_window, self._virus_webview, self._virus_message_handler = _build_web_window(
            self,
            *EXPANDED_SIZE,
        )
        self._virus_window.setTitle_(_VIRUS_WINDOW_TITLE)
        self._sync_overlay_visibility()
        self._virus_window.makeKeyAndOrderFront_(None)
        self._send_virus_state_to_web()
        print("[resident-poc] virus_window opened", flush=True)

    @python_method
    def close_virus_window(self) -> None:
        if self._virus_window is not None:
            window = self._virus_window
            window.setDelegate_(None)
            self._clear_virus_window()
            window.close()
        else:
            self._restart_virus_timer()

    @python_method
    def _clear_virus_window(self) -> None:
        self._virus_window = None
        self._virus_webview = None
        self._virus_message_handler = None
        self._sync_overlay_visibility()
        self._restart_virus_timer()

    @python_method
    def _sync_overlay_visibility(self) -> None:
        if self._overlay is None:
            return

        if self._state.view == "expanded" or self._virus_window is not None:
            self._overlay.orderFront_(None)
            return

        self._overlay.orderOut_(None)

    @python_method
    def _update_window_title(self) -> None:
        if self._window is None:
            return

        title = _SLEEPING_WINDOW_TITLE if self._state.is_sleeping() else _WINDOW_TITLE
        self._window.setTitle_(title)

    @python_method
    def _start_event_monitors(self) -> None:
        if self._global_monitor is not None:
            return

        self._global_monitor = NSEvent.addGlobalMonitorForEventsMatchingMask_handler_(
            NSEventMaskKeyDown,
            self._on_global_key_down,
        )
        self._local_monitor = NSEvent.addLocalMonitorForEventsMatchingMask_handler_(
            NSEventMaskKeyDown,
            self._on_local_key_down,
        )

    @python_method
    def _stop_event_monitors(self) -> None:
        if self._global_monitor is not None:
            NSEvent.removeMonitor_(self._global_monitor)
            self._global_monitor = None
        if self._local_monitor is not None:
            NSEvent.removeMonitor_(self._local_monitor)
            self._local_monitor = None

    @python_method
    def _on_global_key_down(self, event: Any) -> None:
        self._handle_key_event(event)

    @python_method
    def _on_local_key_down(self, event: Any) -> Any:
        return event

    @python_method
    def _handle_key_event(self, event: Any) -> None:
        if self._keyboard.is_virus_hotkey(event):
            if self._state.is_sleeping_or_suspended_sleep():
                return
            self._events.put(_ControlEvent(name="virus", reason="hotkey"))
            return

        if self._keyboard.is_toggle_hotkey(event):
            if self._state.is_sleeping():
                return
            self._events.put(_ControlEvent(name="expand", reason="hotkey"))
            return

        label = self._keyboard.format_key(event)
        if not label:
            return

        self._events.put(_KeyEvent(label=label))
        if self._state.record_key(label):
            self._events.put(_ControlEvent(name="expand", reason="command"))

    @python_method
    def _drain_events(self) -> None:
        while True:
            try:
                event = self._events.get_nowait()
            except queue.Empty:
                break

            if isinstance(event, _ControlEvent):
                if event.name == "expand":
                    self.expand_window(event.reason)
                if event.name == "virus":
                    self.show_virus_window()
                if event.name == "quit":
                    self.shutdown()
                continue

            self._send_state_to_web()
            print(f"[resident-poc] key={event.label}", flush=True)

    @python_method
    def shutdown(self) -> None:
        self._stop_event_monitors()
        NSApp.terminate_(None)

    @python_method
    def run(self) -> None:
        app = NSApplication.sharedApplication()
        app.setActivationPolicy_(NSApplicationActivationPolicyAccessory)
        self.build_window()
        self._restart_virus_timer()
        self._start_event_monitors()
        NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
            POLL_INTERVAL_SECONDS,
            self,
            "pollEvents:",
            None,
            True,
        )
        NSTimer.scheduledTimerWithTimeInterval_target_selector_userInfo_repeats_(
            TIMER_INTERVAL_SECONDS,
            self,
            "tickTimer:",
            None,
            True,
        )
        AppHelper.runEventLoop(installInterrupt=True)
