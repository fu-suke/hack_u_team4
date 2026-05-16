from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any

from linux_virus_frontend.config import DEFAULT_COMMANDS, DEFAULT_TIMER_SECONDS


@dataclass
class _ResidentState:
    view: str = "minimized"
    key_count: int = 0
    timer_seconds: int = DEFAULT_TIMER_SECONDS
    deadline: float | None = None
    commands: list[str] = field(default_factory=lambda: DEFAULT_COMMANDS.copy())
    typed_buffer: str = ""

    def __post_init__(self) -> None:
        self.restart_timer()

    def set_timer_from_message(self, body: dict[Any, Any]) -> str:
        seconds = self._timer_seconds_from_message(body)
        self.timer_seconds = seconds
        self.commands = self._commands_from_message(body)
        self.restart_timer()
        return ", ".join(self.commands)

    def tick_timer_expired(self) -> bool:
        if self.deadline is None or self.remaining_seconds() > 0:
            return False

        self.deadline = None
        return True

    def remaining_seconds(self) -> int:
        if self.deadline is None:
            return 0
        return max(0, int(self.deadline - time.monotonic()))

    def disable_timer(self) -> None:
        self.deadline = None

    def suspend_timer_for_settings(self) -> None:
        self.deadline = None

    def restart_timer(self) -> None:
        self.deadline = time.monotonic() + self.timer_seconds

    def record_key(self, label: str) -> bool:
        self.key_count += 1
        self.typed_buffer = (self.typed_buffer + label)[-80:]
        if self.view == "expanded":
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
            "status": status or self.status_text(),
        }

    def timer_text(self) -> str:
        if self.deadline is None:
            return "Timer: not set"
        return f"Timer: {self.remaining_seconds()}s"

    def status_text(self) -> str:
        if self.view == "settings":
            return "Settings"
        if self.view == "expanded":
            return "Expanded"
        return "Idle"

    def _timer_seconds_from_message(self, body: dict[Any, Any]) -> int:
        raw_seconds = body.get("seconds", DEFAULT_TIMER_SECONDS)
        try:
            return max(1, int(str(raw_seconds)))
        except ValueError:
            return DEFAULT_TIMER_SECONDS

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
