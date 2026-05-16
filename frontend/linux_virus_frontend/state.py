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
)


@dataclass
class _ResidentState:
    view: str = "minimized"
    key_count: int = 0
    timer_seconds: int = DEFAULT_TIMER_SECONDS
    sleep_minutes: int = DEFAULT_SLEEP_MINUTES
    deadline: float | None = None
    sleep_deadline: float | None = None
    commands: list[str] = field(default_factory=lambda: DEFAULT_COMMANDS.copy())
    typed_buffer: str = ""

    def __post_init__(self) -> None:
        self.restart_timer()

    def set_timer_from_message(self, body: dict[Any, Any]) -> str:
        seconds = self._timer_seconds_from_message(body)
        self.timer_seconds = seconds
        self.commands = self._commands_from_message(body)
        self.start_sleep_from_message(body)
        if not self.is_sleeping():
            self.restart_timer()
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

    def suspend_timer_for_settings(self) -> None:
        self.deadline = None

    def restart_timer(self) -> None:
        if self.is_sleeping():
            self.deadline = None
            return
        self.deadline = time.monotonic() + self.timer_seconds

    def start_sleep_from_message(self, body: dict[Any, Any]) -> None:
        self.sleep_minutes = self._sleep_minutes_from_message(body)
        if self.sleep_minutes <= 0:
            self.sleep_deadline = None
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
        if self.view == "expanded" or self.is_sleeping():
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
            "sleepMinutes": (
                self.remaining_sleep_minutes() if self.is_sleeping() else self.sleep_minutes
            ),
            "timerMode": "sleep" if self.is_sleeping() else "timer",
            "status": status or self.status_text(),
        }

    def timer_text(self) -> str:
        if self.is_sleeping():
            return f"Sleep: {self.remaining_sleep_seconds()}s"
        if self.deadline is None:
            return "Timer: not set"
        return f"Timer: {self.remaining_seconds()}s"

    def status_text(self) -> str:
        if self.view == "settings":
            return "Settings"
        if self.view == "expanded":
            return "Expanded"
        if self.is_sleeping():
            return "Sleeping"
        return "Idle"

    def _timer_seconds_from_message(self, body: dict[Any, Any]) -> int:
        raw_seconds = body.get("seconds", DEFAULT_TIMER_SECONDS)
        try:
            return min(MAX_TIMER_SECONDS, max(1, int(str(raw_seconds))))
        except ValueError:
            return DEFAULT_TIMER_SECONDS

    def _sleep_minutes_from_message(self, body: dict[Any, Any]) -> int:
        raw_minutes = body.get("sleepMinutes", DEFAULT_SLEEP_MINUTES)
        try:
            return min(MAX_SLEEP_MINUTES, max(0, int(str(raw_minutes))))
        except ValueError:
            return DEFAULT_SLEEP_MINUTES

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

        raw_command = body.get("command")
        if raw_command is not None:
            command = str(raw_command).strip()
            if command:
                return [command]

        return DEFAULT_COMMANDS.copy()
