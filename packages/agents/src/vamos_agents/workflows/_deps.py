"""Shared workflow dependencies — Anthropic client + SerpApi."""

from __future__ import annotations

from dataclasses import dataclass

from anthropic import Anthropic

from vamos_agents.providers import SerpApiClient
from vamos_agents.settings import Settings


@dataclass(frozen=True)
class WorkflowDeps:
    anthropic: Anthropic
    settings: Settings
    serp: SerpApiClient | None
