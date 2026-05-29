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

    supported_linux_commands: list[str] = Field(
        default_factory=lambda: [
            "cat",
            "cd",
            "chmod",
            "cp",
            "curl",
            "cut",
            "df",
            "du",
            "echo",
            "find",
            "grep",
            "head",
            "kill",
            "ls",
            "mkdir",
            "mv",
            "ps",
            "pwd",
            "rm",
            "sort",
            "tail",
            "tar",
            "touch",
            "uniq",
            "wc",
        ],
        validation_alias="SUPPORTED_LINUX_COMMANDS",
    )
    default_sleep_minutes: int = Field(0, validation_alias="DEFAULT_SLEEP_MINUTES")
    max_sleep_minutes: int = Field(99, validation_alias="MAX_SLEEP_MINUTES")

    edge_margin: float = Field(32.0, validation_alias="EDGE_MARGIN")
    top_margin: float = Field(56.0, validation_alias="TOP_MARGIN")
    minimized_size: tuple[float, float] = Field(
        (220.0, 112.0),
        validation_alias="MINIMIZED_SIZE",
    )
    expanded_size: tuple[float, float] = Field(
        (520.0, 480.0),
        validation_alias="EXPANDED_SIZE",
    )
    settings_size: tuple[float, float] = Field(
        (420.0, 320.0),
        validation_alias="SETTINGS_SIZE",
    )
    user_size: tuple[float, float] = Field(
        (520.0, 440.0),
        validation_alias="USER_SIZE",
    )

    poll_interval_seconds: float = Field(0.1, validation_alias="POLL_INTERVAL_SECONDS")
    timer_interval_seconds: float = Field(0.2, validation_alias="TIMER_INTERVAL_SECONDS")
    virus_poll_interval_minutes: int = Field(5, validation_alias="VIRUS_POLL_INTERVAL_MINUTES")

    api_base_url: str = Field("http://127.0.0.1:8000", validation_alias="API_BASE_URL")
    api_timeout_ms: int = Field(8000, validation_alias="API_TIMEOUT_MS")
    default_tutorial: str = Field(
        "この問題の解説はまだ登録されていません。",
        validation_alias="DEFAULT_TUTORIAL",
    )
    penguin_small_image: str = Field(
        "../image/penguin_small.png",
        validation_alias="PENGUIN_SMALL_IMAGE",
    )
    penguin_medium_image: str = Field(
        "../image/penguin_medium.png",
        validation_alias="PENGUIN_MEDIUM_IMAGE",
    )
    penguin_big_image: str = Field(
        "../image/penguin_big.png",
        validation_alias="PENGUIN_BIG_IMAGE",
    )
    penguin_virus_image: str = Field(
        "../image/penguin_virus.png",
        validation_alias="PENGUIN_VIRUS_IMAGE",
    )

    def public_payload(self) -> dict[str, Any]:
        return {
            "apiBaseUrl": self.api_base_url,
            "apiTimeoutMs": self.api_timeout_ms,
            "supportedLinuxCommands": self.supported_linux_commands,
            "defaultSleepMinutes": self.default_sleep_minutes,
            "maxSleepMinutes": self.max_sleep_minutes,
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

DEFAULT_SLEEP_MINUTES = SETTINGS.default_sleep_minutes
MAX_SLEEP_MINUTES = SETTINGS.max_sleep_minutes
EDGE_MARGIN = SETTINGS.edge_margin
TOP_MARGIN = SETTINGS.top_margin
MINIMIZED_SIZE = SETTINGS.minimized_size
EXPANDED_SIZE = SETTINGS.expanded_size
SETTINGS_SIZE = SETTINGS.settings_size
USER_SIZE = SETTINGS.user_size

POLL_INTERVAL_SECONDS = SETTINGS.poll_interval_seconds
TIMER_INTERVAL_SECONDS = SETTINGS.timer_interval_seconds
VIRUS_POLL_INTERVAL_MINUTES = SETTINGS.virus_poll_interval_minutes

PUBLIC_CONFIG = SETTINGS.public_payload()
