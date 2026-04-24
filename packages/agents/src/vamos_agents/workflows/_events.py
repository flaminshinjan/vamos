"""SSE event helpers shared by chat-agent workflows."""

from __future__ import annotations

import time
from typing import Any


def tool_start(tid: str, label: str, detail: str) -> dict[str, Any]:
    return {
        "event": "tool_call",
        "data": {
            "id": tid,
            "label": label,
            "detail": detail,
            "status": "active",
        },
    }


def tool_done(tid: str, started: float) -> dict[str, Any]:
    return {
        "event": "tool_call",
        "data": {
            "id": tid,
            "status": "done",
            "duration_ms": int((time.perf_counter() - started) * 1000),
        },
    }


def card(kind: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {"event": "card", "data": {"kind": kind, **payload}}


def error(msg: str, code: int = 502) -> dict[str, Any]:
    return {"event": "error", "data": {"error": msg, "code": code}}
