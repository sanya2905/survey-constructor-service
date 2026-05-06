"""Async HTTP client for inter-subsystem communication.

When this survey-constructor subsystem is deployed as part of the larger
АСНИ MFE shell (see architecture docs, section 7), route handlers may
need to call other subsystems' backends (ARM researcher, creative-assessment,
etc.).  This module provides a ready-made async client that:

- Reads base URLs from environment variables (``ARM_API_URL``, etc.)
- Forwards the caller's JWT Bearer token so sub-calls run in the same
  security context.
- Applies a configurable timeout (default 30 s, matching the browser-side
  api layer timeout).
- Raises ``HTTPException(502)`` on upstream failures so the caller gets a
  clean, JSON-serialisable error rather than a raw connection error.

Usage example (inside a route handler)::

    from app.services.http_client import SubsystemClient

    @router.get("/arm/metrics")
    async def proxy_arm_metrics(token: str = Depends(get_raw_token)):
        async with SubsystemClient.for_arm(bearer=token) as client:
            return await client.get("/api/v1/analyze/metrics/history")
"""

from __future__ import annotations

import os
from typing import Any

import httpx
from fastapi import HTTPException

# Default timeout used across all outbound calls (seconds).
_DEFAULT_TIMEOUT = 30.0


class SubsystemClient:
    """Thin async HTTP client wrapper for one upstream subsystem."""

    def __init__(self, base_url: str, bearer: str | None = None, timeout: float = _DEFAULT_TIMEOUT) -> None:
        headers: dict[str, str] = {"Accept": "application/json"}
        if bearer:
            headers["Authorization"] = f"Bearer {bearer}"
        self._client = httpx.AsyncClient(
            base_url=base_url,
            headers=headers,
            timeout=timeout,
        )

    # ── context-manager protocol ──────────────────────────────────────────────

    async def __aenter__(self) -> "SubsystemClient":
        await self._client.__aenter__()
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self._client.__aexit__(*args)

    # ── factory helpers ───────────────────────────────────────────────────────

    @classmethod
    def for_arm(cls, bearer: str | None = None) -> "SubsystemClient":
        """Client targeting the ARM-researcher backend."""
        url = os.getenv("ARM_API_URL", "http://arm-mfe:8000")
        return cls(url, bearer=bearer)

    @classmethod
    def for_creative(cls, bearer: str | None = None) -> "SubsystemClient":
        """Client targeting the creative-assessment backend."""
        url = os.getenv("CREATIVE_API_URL", "http://creative-mfe:8000")
        return cls(url, bearer=bearer)

    @classmethod
    def for_url(cls, url: str, bearer: str | None = None) -> "SubsystemClient":
        """Client for an arbitrary subsystem URL."""
        return cls(url, bearer=bearer)

    # ── request helpers ───────────────────────────────────────────────────────

    async def get(self, path: str, **kwargs: Any) -> Any:
        return await self._request("GET", path, **kwargs)

    async def post(self, path: str, **kwargs: Any) -> Any:
        return await self._request("POST", path, **kwargs)

    async def put(self, path: str, **kwargs: Any) -> Any:
        return await self._request("PUT", path, **kwargs)

    async def delete(self, path: str, **kwargs: Any) -> Any:
        return await self._request("DELETE", path, **kwargs)

    async def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        try:
            response = await self._client.request(method, path, **kwargs)
        except httpx.TimeoutException as exc:
            raise HTTPException(504, f"Upstream subsystem timed out: {exc}") from exc
        except httpx.RequestError as exc:
            raise HTTPException(502, f"Upstream subsystem unreachable: {exc}") from exc

        if response.is_error:
            raise HTTPException(
                502,
                f"Upstream subsystem returned {response.status_code}: {response.text[:200]}",
            )
        return response.json()
