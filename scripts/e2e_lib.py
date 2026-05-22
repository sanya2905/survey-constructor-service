#!/usr/bin/env python3
"""Shared helpers for E2E scripts."""
import json
import sys
import time
import urllib.request
import urllib.parse
import urllib.error


def request_json(method, url, data=None, headers=None, timeout=30, expect_status=None):
    data_bytes = None
    hdrs = dict(headers or {})
    if data is not None:
        data_bytes = json.dumps(data).encode()
        hdrs["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data_bytes, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            if not body:
                return {}
            return json.loads(body.decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        if expect_status and e.code == expect_status:
            try:
                return json.loads(body)
            except json.JSONDecodeError:
                return {"raw": body, "status": e.code}
        print(f"HTTPError {e.code}: {body}", file=sys.stderr)
        raise


def wait_for_api(api_base, timeout=60):
    deadline = time.time() + timeout
    base = api_base.split('/api')[0]
    url = base + "/healthz"
    while time.time() < deadline:
        try:
            req = urllib.request.Request(url, method="GET")
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status < 500:
                    return True
        except Exception:
            time.sleep(1)
    return False


def login(api_base, username, password):
    data = urllib.parse.urlencode({"username": username, "password": password}).encode()
    req = urllib.request.Request(
        api_base + "/auth/token",
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        token_resp = json.loads(resp.read().decode())
        return token_resp.get("access_token")


def register_user(api_base, username, password, email, role="user"):
    try:
        request_json(
            "POST",
            api_base + "/auth/register",
            {"username": username, "password": password, "role": role, "email": email},
        )
        return True
    except Exception:
        return False


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}
