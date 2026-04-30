import logging
import warnings

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.core.db import init_db, get_db
from app.api.v1.router import router as v1_router

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Survey Constructor Subsystem",
    version=settings.SUBSYSTEM_VERSION,
    description=(
        "Подсистема-конструктор анкетирования. "
        "Часть АСНИ социологических данных."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await init_db()
    if settings.JWT_SECRET_KEY == "changeme":
        warnings.warn(
            "JWT_SECRET_KEY is set to the default value 'changeme'. "
            "Set a strong secret in your .env before deploying to production.",
            stacklevel=1,
        )
    if settings.PROXY_AUTH_ENABLED:
        logger.info("Proxy authentication is ENABLED — trusting X-Forwarded-User/Role headers.")
    if not settings.REGISTRATION_OPEN:
        logger.info("Public self-registration is DISABLED.")


# ---------------------------------------------------------------------------
# Health / discovery endpoints (no auth required — safe for load-balancers
# and parent-app service-discovery).
# ---------------------------------------------------------------------------

@app.get("/healthz", tags=["ops"])
async def healthz():
    """Liveness probe. Also performs a trivial DB round-trip."""
    try:
        # Use a fresh session from the generator
        async for db in get_db():
            await db.execute(text("SELECT 1"))
            break
        db_ok = True
    except Exception:
        db_ok = False
    return {"status": "ok" if db_ok else "degraded", "db": db_ok}


@app.get("/api/v1/info", tags=["ops"])
async def subsystem_info():
    """
    Identity endpoint for the parent application.
    Returns stable metadata so the parent can discover and route to this
    subsystem without hard-coding strings in multiple places.
    """
    return {
        "subsystem": settings.SUBSYSTEM_NAME,
        "version": settings.SUBSYSTEM_VERSION,
        "api_prefix": "/api/v1",
        "registration_open": settings.REGISTRATION_OPEN,
        "proxy_auth_enabled": settings.PROXY_AUTH_ENABLED,
        "capabilities": [
            "survey-create",
            "survey-publish",
            "survey-respond",
            "responses-export-json",
            "responses-export-csv",
        ],
    }


app.include_router(v1_router)
