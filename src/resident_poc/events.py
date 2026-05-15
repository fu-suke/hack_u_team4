from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class _KeyEvent:
    label: str


@dataclass(frozen=True)
class _ControlEvent:
    name: str
    reason: str = ""
