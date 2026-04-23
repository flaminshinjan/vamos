"""Dependency injection — build services once per process."""

from __future__ import annotations

from functools import lru_cache

from vamos_agents.advisor import AdvisorAgent
from vamos_agents.settings import get_settings
from vamos_core import DataLoader

from vamos_api.core.config import get_config


@lru_cache(maxsize=1)
def get_data_loader() -> DataLoader:
    cfg = get_config()
    return DataLoader(cfg.data_dir)


@lru_cache(maxsize=1)
def get_advisor() -> AdvisorAgent:
    return AdvisorAgent(loader=get_data_loader(), settings=get_settings())
