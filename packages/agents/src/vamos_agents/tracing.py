"""Langfuse tracing — no-op if keys not set, so local dev never breaks."""

from __future__ import annotations

import logging
import os
import uuid
from contextlib import contextmanager
from typing import Any, Iterator

from vamos_agents.settings import get_settings

logger = logging.getLogger(__name__)

try:
    from langfuse import Langfuse

    _LANGFUSE_AVAILABLE = True
except ImportError:
    _LANGFUSE_AVAILABLE = False


class Tracer:
    """Thin wrapper around Langfuse — exposes a uniform interface whether
    tracing is configured or not.

    Usage:
        tracer = Tracer()
        with tracer.trace("advisor.run", user_id="...", metadata={...}) as trace:
            with trace.span("reasoning") as span:
                span.log_generation(model="...", input=..., output=..., usage={...})
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.enabled = (
            _LANGFUSE_AVAILABLE
            and bool(settings.langfuse_public_key)
            and bool(settings.langfuse_secret_key)
        )
        self._client: Any = None
        if self.enabled:
            try:
                self._client = Langfuse(
                    public_key=settings.langfuse_public_key,
                    secret_key=settings.langfuse_secret_key,
                    host=settings.langfuse_host,
                )
            except Exception as e:
                logger.warning("Langfuse init failed, disabling tracing: %s", e)
                self.enabled = False

    @contextmanager
    def trace(
        self,
        name: str,
        *,
        user_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Iterator["TraceHandle"]:
        trace_id = str(uuid.uuid4())
        if not self.enabled:
            yield _NoopTrace(trace_id)
            return
        lf_trace = self._client.trace(
            id=trace_id, name=name, user_id=user_id, metadata=metadata or {}
        )
        handle = _LangfuseTrace(trace_id, lf_trace)
        try:
            yield handle
        finally:
            try:
                self._client.flush()
            except Exception as e:
                logger.warning("Langfuse flush failed: %s", e)


class TraceHandle:
    trace_id: str

    @contextmanager
    def span(self, name: str, **kwargs: Any) -> Iterator["SpanHandle"]:  # pragma: no cover
        raise NotImplementedError


class SpanHandle:
    def log_generation(self, **kwargs: Any) -> None: ...  # pragma: no cover
    def update(self, **kwargs: Any) -> None: ...  # pragma: no cover


class _NoopSpan(SpanHandle):
    def log_generation(self, **kwargs: Any) -> None:
        return None

    def update(self, **kwargs: Any) -> None:
        return None


class _NoopTrace(TraceHandle):
    def __init__(self, trace_id: str) -> None:
        self.trace_id = trace_id

    @contextmanager
    def span(self, name: str, **kwargs: Any) -> Iterator[SpanHandle]:
        yield _NoopSpan()

    def update(self, **kwargs: Any) -> None:
        return None


class _LangfuseSpan(SpanHandle):
    def __init__(self, span: Any) -> None:
        self._span = span

    def log_generation(
        self,
        *,
        model: str,
        input: Any,
        output: Any,
        usage: dict[str, int] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        try:
            self._span.generation(
                name="llm_call",
                model=model,
                input=input,
                output=output,
                usage=usage or {},
                metadata=metadata or {},
            )
        except Exception as e:
            logger.debug("Langfuse generation log failed: %s", e)

    def update(self, **kwargs: Any) -> None:
        try:
            self._span.update(**kwargs)
        except Exception as e:
            logger.debug("Langfuse span update failed: %s", e)


class _LangfuseTrace(TraceHandle):
    def __init__(self, trace_id: str, lf_trace: Any) -> None:
        self.trace_id = trace_id
        self._lf = lf_trace

    @contextmanager
    def span(self, name: str, **kwargs: Any) -> Iterator[SpanHandle]:
        try:
            span = self._lf.span(name=name, **kwargs)
        except Exception as e:
            logger.debug("Langfuse span create failed: %s", e)
            yield _NoopSpan()
            return
        wrapped = _LangfuseSpan(span)
        try:
            yield wrapped
        finally:
            try:
                span.end()
            except Exception:
                pass

    def update(self, **kwargs: Any) -> None:
        try:
            self._lf.update(**kwargs)
        except Exception as e:
            logger.debug("Langfuse trace update failed: %s", e)


# Module-level singleton
_tracer: Tracer | None = None


def get_tracer() -> Tracer:
    global _tracer
    if _tracer is None:
        _tracer = Tracer()
    return _tracer
