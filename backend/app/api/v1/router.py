from fastapi import APIRouter
from app.api.v1 import surveys, public

router = APIRouter(prefix="/api/v1")
router.include_router(surveys.router, tags=["surveys"])
router.include_router(public.router, tags=["public"])