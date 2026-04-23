"""Structured logging setup — JSON lines in production, colored in dev."""

from __future__ import annotations

import logging
import os
import sys


def setup_logging(level: str = "INFO") -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)-8s %(name)s | %(message)s",
        stream=sys.stdout,
    )
    # Quiet noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    if os.getenv("ANTHROPIC_LOG") != "debug":
        logging.getLogger("anthropic").setLevel(logging.WARNING)
