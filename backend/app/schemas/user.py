import uuid
from pydantic import BaseModel


class UserCreate(BaseModel):
    username: str
    password: str
    role: str | None = "user"
    email: str | None = None


class UserOut(BaseModel):
    id: uuid.UUID
    username: str
    email: str | None
    role: str
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None
