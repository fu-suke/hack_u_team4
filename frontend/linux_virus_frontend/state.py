from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from linux_virus_frontend.config import DEFAULT_SLEEP_MINUTES, MAX_SLEEP_MINUTES, PUBLIC_CONFIG


@dataclass
class _ResidentState:
    view: str = "minimized"
    sleep_minutes: int = DEFAULT_SLEEP_MINUTES
    sleep_deadline: float | None = None
    current_user: dict[str, Any] | None = None
    trigger_command: str | None = None

    def set_sleep_from_message(self, body: dict[Any, Any]) -> None:
        self.start_sleep(self._sleep_minutes_from_message(body))

    def start_sleep(self, sleep_minutes: int) -> None:
        self.sleep_minutes = sleep_minutes
        if sleep_minutes <= 0:
            self.sleep_deadline = None
            return
        self.sleep_deadline = time.monotonic() + sleep_minutes * 60

    def is_sleeping(self) -> bool:
        if self.sleep_deadline is None:
            return False
        return self.remaining_sleep_seconds() > 0

    def remaining_sleep_seconds(self) -> int:
        if self.sleep_deadline is None:
            return 0
        return max(0, int(self.sleep_deadline - time.monotonic()))

    def sleep_minutes_for_input(self) -> int:
        return self.sleep_minutes

    def sleep_timer_text(self) -> str:
        return f"Sleep: {self.remaining_sleep_seconds()}s"

    def payload(self, status: str | None = None) -> dict[str, Any]:
        return {
            "state": self.view,
            "timerText": self.sleep_timer_text() if self.is_sleeping() else "",
            "sleepMinutes": self.sleep_minutes_for_input(),
            "timerMode": "sleep" if self.is_sleeping() else "idle",
            "status": status or self.status_text(),
            "config": PUBLIC_CONFIG,
            "currentUser": self.current_user,
            "triggerCommand": self.trigger_command,
        }

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

    def _sleep_minutes_from_message(self, body: dict[Any, Any]) -> int:
        raw_minutes = body.get("sleepMinutes", DEFAULT_SLEEP_MINUTES)
        try:
            return min(MAX_SLEEP_MINUTES, max(0, int(float(str(raw_minutes)))))
        except (TypeError, ValueError):
            return DEFAULT_SLEEP_MINUTES
