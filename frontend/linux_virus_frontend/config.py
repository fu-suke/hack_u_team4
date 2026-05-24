from __future__ import annotations

from pathlib import Path
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ENV_PUBLIC_PATH = Path(__file__).resolve().parents[1] / ".env.public"


class FrontendSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ENV_PUBLIC_PATH,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    default_timer_seconds: int = 60
    default_sleep_minutes: int = 0
    max_timer_seconds: int = 99 * 60 + 59
    max_sleep_minutes: int = 99
    default_commands: list[str] = Field(default_factory=lambda: ["<cmd>+v"])

    edge_margin: float = 32.0
    top_margin: float = 56.0
    minimized_size: tuple[float, float] = (220.0, 112.0)
    expanded_size: tuple[float, float] = (520.0, 580.0)
    settings_size: tuple[float, float] = (520.0, 440.0)

    poll_interval_seconds: float = 0.1
    timer_interval_seconds: float = 0.2
    virus_poll_interval_minutes: int = 5

    special_key_labels: dict[int, str] = Field(
        default_factory=lambda: {
            36: "<return>",
            48: "<tab>",
            49: "<space>",
            51: "<delete>",
            53: "<escape>",
            123: "<left>",
            124: "<right>",
            125: "<down>",
            126: "<up>",
        }
    )

    api_base_url: str = "http://127.0.0.1:8000"
    api_timeout_ms: int = 8000
    default_tutorial: str = "この問題の解説はまだ登録されていません。"
    penguin_small_image: str = "../image/penguin_small.png"
    penguin_medium_image: str = "../image/penguin_medium.png"
    penguin_big_image: str = "../image/penguin_big.png"
    penguin_virus_image: str = "../image/penguin_virus.png"

    def public_payload(self) -> dict[str, Any]:
        return {
            "apiBaseUrl": self.api_base_url,
            "apiTimeoutMs": self.api_timeout_ms,
            "defaultTimerSeconds": self.default_timer_seconds,
            "defaultSleepMinutes": self.default_sleep_minutes,
            "maxTimerSeconds": self.max_timer_seconds,
            "maxSleepMinutes": self.max_sleep_minutes,
            "defaultCommands": self.default_commands,
            "virusPollIntervalMinutes": self.virus_poll_interval_minutes,
            "defaultTutorial": self.default_tutorial,
            "penguinImages": {
                "1": self.penguin_small_image,
                "2": self.penguin_medium_image,
                "3": self.penguin_big_image,
                "virus": self.penguin_virus_image,
            },
        }


SETTINGS = FrontendSettings()

DEFAULT_TIMER_SECONDS = SETTINGS.default_timer_seconds
DEFAULT_SLEEP_MINUTES = SETTINGS.default_sleep_minutes
MAX_TIMER_SECONDS = SETTINGS.max_timer_seconds
MAX_SLEEP_MINUTES = SETTINGS.max_sleep_minutes
DEFAULT_COMMANDS = SETTINGS.default_commands

EDGE_MARGIN = SETTINGS.edge_margin
TOP_MARGIN = SETTINGS.top_margin
MINIMIZED_SIZE = SETTINGS.minimized_size
EXPANDED_SIZE = SETTINGS.expanded_size
SETTINGS_SIZE = SETTINGS.settings_size

POLL_INTERVAL_SECONDS = SETTINGS.poll_interval_seconds
TIMER_INTERVAL_SECONDS = SETTINGS.timer_interval_seconds
VIRUS_POLL_INTERVAL_MINUTES = SETTINGS.virus_poll_interval_minutes

SPECIAL_KEY_LABELS = SETTINGS.special_key_labels

PUBLIC_CONFIG = SETTINGS.public_payload()
