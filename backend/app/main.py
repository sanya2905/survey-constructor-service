from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.db import init_db
from app.api.v1.router import router as v1_router

app = FastAPI(title="Survey Service", version="0.1.0")

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

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

app.include_router(v1_router)