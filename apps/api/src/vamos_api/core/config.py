"""API configuration."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path


class APIConfig:
    def __init__(self) -> None:
        self.host = os.getenv("API_HOST", "0.0.0.0")
        self.port = int(os.getenv("API_PORT", "8247"))
        self.data_dir = Path(os.getenv("VAMOS_DATA_DIR", "./data")).resolve()
        self.cors_origins = [
            o.strip()
            for o in os.getenv("API_CORS_ORIGINS", "http://localhost:4247").split(",")
            if o.strip()
        ]
        self.log_level = os.getenv("LOG_LEVEL", "INFO")


@lru_cache(maxsize=1)
def get_config() -> APIConfig:
    return APIConfig()
