"""FastAPI app factory + uvicorn runner."""

from __future__ import annotations

import logging

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env before anything else imports settings
load_dotenv()

from vamos_api.core.config import get_config  # noqa: E402
from vamos_api.core.deps import get_data_loader  # noqa: E402
from vamos_api.core.logging import setup_logging  # noqa: E402
from vamos_api.routes import advisor, market, news, portfolio  # noqa: E402

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    cfg = get_config()
    setup_logging(cfg.log_level)

    app = FastAPI(
        title="Vamos — Autonomous Financial Advisor",
        description=(
            "Reasoning-first portfolio intelligence. Chains macro news → "
            "sector trends → individual stocks → portfolio impact."
        ),
        version="0.1.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=cfg.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(portfolio.router)
    app.include_router(market.router)
    app.include_router(news.router)
    app.include_router(advisor.router)

    @app.get("/health", tags=["_meta"])
    def health() -> dict:
        loader = get_data_loader()
        return {
            "status": "ok",
            "data_dir": str(cfg.data_dir),
            "portfolios": loader.list_portfolio_ids(),
            "news_count": len(loader.news),
        }

    @app.get("/", tags=["_meta"])
    def root() -> dict:
        return {
            "service": "vamos-api",
            "docs": "/docs",
            "health": "/health",
        }

    logger.info("Vamos API ready. Data dir: %s", cfg.data_dir)
    return app


app = create_app()


def run() -> None:
    """Entry point for `vamos-api` console script."""
    import uvicorn

    cfg = get_config()
    uvicorn.run(
        "vamos_api.main:app",
        host=cfg.host,
        port=cfg.port,
        reload=False,
        log_level=cfg.log_level.lower(),
    )


if __name__ == "__main__":
    run()
