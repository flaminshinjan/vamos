# syntax=docker/dockerfile:1.7

FROM python:3.11-slim AS base
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1
RUN pip install uv

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY pyproject.toml ./
COPY packages/core/pyproject.toml ./packages/core/pyproject.toml
COPY packages/agents/pyproject.toml ./packages/agents/pyproject.toml
COPY apps/api/pyproject.toml ./apps/api/pyproject.toml

# Copy the source
COPY packages/core ./packages/core
COPY packages/agents ./packages/agents
COPY apps/api ./apps/api

# Install the whole workspace (editable for fast rebuilds in dev; wheel for prod)
RUN uv pip install --system ./packages/core ./packages/agents ./apps/api

# Data is mounted at runtime in prod; bake a copy for the image so it works standalone
COPY data ./data

ENV VAMOS_DATA_DIR=/app/data \
    API_HOST=0.0.0.0 \
    API_PORT=8247

EXPOSE 8247
CMD ["python", "-m", "vamos_api.main"]
