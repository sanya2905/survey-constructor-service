from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from fastapi.security.utils import get_authorization_scheme_param
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.db import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# auto_error=False so we can fall back to proxy-header auth without a 401
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/token", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    res = await db.execute(select(User).where(User.username == username))
    return res.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, username: str, password: str) -> Optional[User]:
    user = await get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm="HS256")
    return encoded_jwt


# ---------------------------------------------------------------------------
# Proxy-auth: a lightweight stand-in for a real User when the parent app
# provides identity via trusted headers (PROXY_AUTH_ENABLED=true).
# The object intentionally mirrors the fields that has_role() and endpoints
# inspect so no route code needs to change.
# ---------------------------------------------------------------------------
class _ProxyUser:
    """Represents a user authenticated by a trusted upstream proxy."""

    def __init__(self, username: str, role: str) -> None:
        self.username = username
        self.role = role
        self.is_active = True
        self.id = None
        self.email = None


async def get_current_user(
    request: Request,
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Resolve the current user from one of two sources (in priority order):

    1. Bearer JWT token — standard path used by the local frontend.
    2. X-Forwarded-User / X-Forwarded-Role headers — set by a trusted parent
       application or reverse-proxy when PROXY_AUTH_ENABLED=true.

    Raises HTTP 401 if neither source provides valid credentials.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # --- path 1: JWT Bearer token -------------------------------------------
    if token:
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])
            username: str = payload.get("sub")
            if username is None:
                raise credentials_exception
        except JWTError:
            raise credentials_exception
        user = await get_user_by_username(db, username)
        if user is None:
            raise credentials_exception
        return user

    # --- path 2: proxy headers -----------------------------------------------
    if settings.PROXY_AUTH_ENABLED:
        fwd_user = request.headers.get("X-Forwarded-User", "").strip()
        fwd_role = request.headers.get("X-Forwarded-Role", "").strip()
        if fwd_user and fwd_role:
            return _ProxyUser(username=fwd_user, role=fwd_role)  # type: ignore[return-value]

    raise credentials_exception


async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


def has_role(role: str):
    async def role_checker(current_user: User = Depends(get_current_active_user)) -> User:
        # admin and researcher have all privileges
        if current_user.role == role or current_user.role in ("admin", "researcher"):
            return current_user
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient privileges")

    return role_checker
