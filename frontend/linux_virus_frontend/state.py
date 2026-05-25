from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from linux_virus_frontend.config import (
    DEFAULT_COMMANDS,
    DEFAULT_SLEEP_MINUTES,
    DEFAULT_TIMER_SECONDS,
    MAX_SLEEP_MINUTES,
    MAX_TIMER_SECONDS,
    MIN_TIMER_SECONDS,
    PUBLIC_CONFIG,
)


@dataclass
class _ResidentState:
    view: str = "minimized"
    key_count: int = 0
    timer_seconds: int = DEFAULT_TIMER_SECONDS
    sleep_minutes: int = DEFAULT_SLEEP_MINUTES
    deadline: float | None = None
    sleep_deadline: float | None = None
    suspended_timer_seconds: int | None = None
    suspended_sleep_seconds: int | None = None
    suspended_sleep_input_minutes: int | None = None
    commands: list[str] = field(default_factory=lambda: DEFAULT_COMMANDS.copy())
    typed_buffer: str = ""
    current_user: dict[str, Any] | None = None

    def __post_init__(self) -> None:
        self.restart_timer()

    def set_timer_from_message(self, body: dict[Any, Any]) -> str:
        seconds = self._timer_seconds_from_message(body)
        sleep_minutes = self._sleep_minutes_from_message(body)
        timing_changed = self._settings_timing_changed(seconds, sleep_minutes)

        self.timer_seconds = seconds
        self.commands = self._commands_from_message(body)

        if timing_changed:
            self.start_sleep(sleep_minutes)

        return ", ".join(self.commands)

    def tick_timer_expired(self) -> bool:
        if self.is_sleeping():
            return False

        if self.sleep_deadline is not None:
            self.sleep_deadline = None
            self.restart_timer()
            return False

        if self.deadline is None or self.remaining_seconds() > 0:
            return False

        self.deadline = None
        return True

    def remaining_seconds(self) -> int:
        if self.deadline is None:
            return 0
        return max(0, int(self.deadline - time.monotonic()))

    def remaining_sleep_seconds(self) -> int:
        if self.sleep_deadline is None:
            return 0
        return max(0, int(self.sleep_deadline - time.monotonic()))

    def remaining_sleep_minutes(self) -> int:
        seconds = self.remaining_sleep_seconds()
        if seconds <= 0:
            return 0
        return max(1, int((seconds + 59) // 60))

    def disable_timer(self) -> None:
        self.deadline = None
        self.suspended_timer_seconds = None
        self.suspended_sleep_seconds = None
        self.suspended_sleep_input_minutes = None

    def suspend_timer_for_settings(self) -> None:
        self.suspended_timer_seconds = (
            self.remaining_seconds() if self.deadline is not None else None
        )
        self.suspended_sleep_seconds = (
            self.remaining_sleep_seconds() if self.sleep_deadline is not None else None
        )
        self.suspended_sleep_input_minutes = (
            self.remaining_sleep_minutes() if self.sleep_deadline is not None else None
        )
        self.deadline = None
        self.sleep_deadline = None

    def restart_timer(self) -> None:
        if self.is_sleeping():
            self.deadline = None
            return
        self.deadline = time.monotonic() + self.timer_seconds

    def resume_suspended_timer(self) -> None:
        if self.suspended_sleep_seconds is not None and self.suspended_sleep_seconds > 0:
            self.sleep_deadline = time.monotonic() + self.suspended_sleep_seconds
            self.deadline = None
        elif self.suspended_timer_seconds is not None and self.suspended_timer_seconds > 0:
            self.deadline = time.monotonic() + self.suspended_timer_seconds
        else:
            self.restart_timer()

        self.suspended_timer_seconds = None
        self.suspended_sleep_seconds = None
        self.suspended_sleep_input_minutes = None

    def start_sleep_from_message(self, body: dict[Any, Any]) -> None:
        self.start_sleep(self._sleep_minutes_from_message(body))

    def start_sleep(self, sleep_minutes: int) -> None:
        self.suspended_timer_seconds = None
        self.suspended_sleep_seconds = None
        self.suspended_sleep_input_minutes = None
        self.sleep_minutes = sleep_minutes
        if self.sleep_minutes <= 0:
            self.sleep_deadline = None
            self.restart_timer()
            return

        self.deadline = None
        self.sleep_deadline = time.monotonic() + self.sleep_minutes * 60

    def is_sleeping(self) -> bool:
        if self.sleep_deadline is None:
            return False
        return self.remaining_sleep_seconds() > 0

    def record_key(self, label: str) -> bool:
        self.key_count += 1
        self.typed_buffer = (self.typed_buffer + label)[-80:]
        if self.view in ("expanded", "settings") or self.is_sleeping():
            return False

        return any(self.typed_buffer.endswith(command) for command in self.commands)

    def payload(self, status: str | None = None) -> dict[str, Any]:
        return {
            "state": self.view,
            "timerText": self.timer_text(),
            "keyCount": self.key_count,
            "buffer": self.typed_buffer[-24:] or "-",
            "commands": self.commands,
            "timerSeconds": self.timer_seconds,
            "sleepMinutes": self.sleep_minutes_for_input(),
            "timerMode": "sleep" if self.is_sleeping_or_suspended_sleep() else "timer",
            "status": status or self.status_text(),
            "config": PUBLIC_CONFIG,
            "currentUser": self.current_user,
        }

    def timer_text(self) -> str:
        if self.is_sleeping():
            return f"Sleep: {self.remaining_sleep_seconds()}s"
        if self.suspended_timer_seconds is not None:
            return f"Timer: {max(0, self.suspended_timer_seconds)}s"
        if self.deadline is None:
            return "Timer: not set"
        return f"Timer: {self.remaining_seconds()}s"

    def status_text(self) -> str:
        if self.view == "settings":
            return "Settings"
        if self.view == "user":
            return "User"
        if self.view == "expanded":
            return "Expanded"
        if self.is_sleeping():
            return "Sleeping"
        return "Idle"

    def sleep_minutes_for_input(self) -> int:
        if self.suspended_sleep_input_minutes is not None:
            return self.suspended_sleep_input_minutes
        if self.is_sleeping():
            return self.remaining_sleep_minutes()
        return self.sleep_minutes

    def is_sleeping_or_suspended_sleep(self) -> bool:
        return self.is_sleeping() or (
            self.suspended_sleep_seconds is not None and self.suspended_sleep_seconds > 0
        )

    def is_timer_suspended(self) -> bool:
        return (
            self.suspended_timer_seconds is not None
            or self.suspended_sleep_seconds is not None
            or self.suspended_sleep_input_minutes is not None
        )

    def _timer_seconds_from_message(self, body: dict[Any, Any]) -> int:
        raw_seconds = body.get("seconds", DEFAULT_TIMER_SECONDS)
        try:
            return min(MAX_TIMER_SECONDS, max(MIN_TIMER_SECONDS, int(float(str(raw_seconds)))))
        except (TypeError, ValueError):
            return DEFAULT_TIMER_SECONDS

    def _sleep_minutes_from_message(self, body: dict[Any, Any]) -> int:
        raw_minutes = body.get("sleepMinutes", DEFAULT_SLEEP_MINUTES)
        try:
            return min(MAX_SLEEP_MINUTES, max(0, int(float(str(raw_minutes)))))
        except (TypeError, ValueError):
            return DEFAULT_SLEEP_MINUTES

    def _settings_timing_changed(self, seconds: int, sleep_minutes: int) -> bool:
        current_sleep_minutes = (
            self.suspended_sleep_input_minutes
            if self.suspended_sleep_input_minutes is not None
            else self.sleep_minutes
        )
        return seconds != self.timer_seconds or sleep_minutes != current_sleep_minutes

    def _commands_from_message(self, body: dict[Any, Any]) -> list[str]:
        raw_commands = body.get("commands")
        if raw_commands is not None:
            try:
                raw_values = list(raw_commands)
            except TypeError:
                raw_values = [raw_commands]

            if raw_values:
                commands = [str(command).strip() for command in raw_values]
                commands = [command for command in commands if command]
                return commands or DEFAULT_COMMANDS.copy()

        return DEFAULT_COMMANDS.copy()
