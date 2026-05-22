#!/usr/bin/env python3
"""
Seed / reset users for each role using the app's password hasher.
Run inside the API container where dependencies are installed.

Usage (from host):
  docker cp scripts/seed_users.py <api-container>:/tmp/seed_users.py
  docker exec <api-container> python3 /tmp/seed_users.py
"""
import asyncio
import sys
sys.path.insert(0, "/app")

from sqlalchemy import select
from app.core.db import SessionLocal
from app.core.auth import get_password_hash, authenticate_user
from app.models.user import User


USERS = [
    {"username": "admin1",     "password": "adminpass123",     "role": "admin",       "email": "admin1@example.com"},
    {"username": "researcher1","password": "researcherpass123","role": "researcher", "email": "researcher1@example.com"},
    {"username": "student1",   "password": "studentpass123",   "role": "student",     "email": "student1@example.com"},
]


async def seed():
    async with SessionLocal() as db:
        for u in USERS:
            res = await db.execute(select(User).where(User.username == u["username"]))
            existing = res.scalar_one_or_none()
            if existing:
                existing.hashed_password = get_password_hash(u["password"])
                existing.role = u["role"]
                existing.is_active = True
                existing.email = u["email"]
                print(f"Reset password for existing user: {u['username']} (role={u['role']})")
            else:
                user = User(
                    username=u["username"],
                    email=u["email"],
                    hashed_password=get_password_hash(u["password"]),
                    role=u["role"],
                    is_active=True,
                )
                db.add(user)
                print(f"Created user: {u['username']} (role={u['role']})")
        await db.commit()

        # Verify passwords via authenticate_user (same path as /auth/token)
        print("\n--- Verification ---")
        for u in USERS:
            user = await authenticate_user(db, u["username"], u["password"])
            if user:
                print(f"OK  : {u['username']} (role={user.role})")
            else:
                print(f"FAIL: {u['username']}")


if __name__ == "__main__":
    asyncio.run(seed())
