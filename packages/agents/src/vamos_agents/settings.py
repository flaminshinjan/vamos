"""Runtime configuration — read once, cache."""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    anthropic_api_key: str | None
    reasoning_model: str
    eval_model: str
    langfuse_public_key: str | None
    langfuse_secret_key: str | None
    langfuse_host: str
    data_dir: Path
    max_output_tokens: int
    request_timeout_s: float


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings(
        anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
        reasoning_model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        eval_model=os.getenv("ANTHROPIC_EVAL_MODEL", "claude-haiku-4-5-20251001"),
        langfuse_public_key=os.getenv("LANGFUSE_PUBLIC_KEY"),
        langfuse_secret_key=os.getenv("LANGFUSE_SECRET_KEY"),
        langfuse_host=os.getenv("LANGFUSE_HOST", "https://cloud.langfuse.com"),
        data_dir=Path(os.getenv("VAMOS_DATA_DIR", "./data")),
        max_output_tokens=int(os.getenv("VAMOS_MAX_TOKENS", "1536")),
        request_timeout_s=float(os.getenv("VAMOS_TIMEOUT_S", "60")),
    )
