from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

async def init_db() -> None:
    # Таблицы создаются миграциями Alembic; автосоздание здесь отключено.
    return None

async def get_db() -> AsyncSession:
    async with SessionLocal() as session:
        yield session