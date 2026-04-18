#!/usr/bin/env python3
"""E2E smoke script: register -> login -> create -> publish -> update -> start session -> complete session

Usage: python3 scripts/e2e_smoke.py [--api http://localhost:8001/api/v1]
"""
import sys
import time
import json
import argparse
import urllib.request
import urllib.parse


def request_json(method, url, data=None, headers=None, timeout=30):
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
        print(f"HTTPError {e.code}: {body}", file=sys.stderr)
        raise


def wait_for_api(api_base, timeout=60):
    deadline = time.time() + timeout
    # Health endpoint is at service root (/healthz); derive base URL
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


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default="http://localhost:8001/api/v1")
    args = p.parse_args()
    API = args.api.rstrip("/")

    print("Waiting for API...", API)
    if not wait_for_api(API):
        print("API did not become ready", file=sys.stderr)
        sys.exit(2)

    username = f"e2e_admin_{int(time.time())}"
    password = "password"
    email = f"{username}@example.test"

    print("Registering", username)
    try:
        request_json("POST", API + "/auth/register", {"username": username, "password": password, "role": "admin", "email": email})
    except Exception:
        print("Register may have failed or user exists; continuing")

    print("Logging in...")
    data = urllib.parse.urlencode({"username": username, "password": password}).encode()
    req = urllib.request.Request(API + "/auth/token", data=data, headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            token_resp = json.loads(resp.read().decode())
            token = token_resp.get("access_token")
    except Exception as e:
        print("Login failed:", e, file=sys.stderr)
        sys.exit(3)

    if not token:
        print("No access token received", file=sys.stderr)
        sys.exit(4)

    headers = {"Authorization": f"Bearer {token}"}
    print("Creating survey...")
    survey_payload = {"title": "E2E Survey", "survey_json": {"title": "E2E Survey", "pages": [{"name": "page1", "elements": [{"type": "text", "name": "q1", "title": "Q1"}]}]}}
    created = request_json("POST", API + "/surveys", survey_payload, headers=headers)
    survey_id = created.get("id")
    print("Survey id:", survey_id)

    print("Publishing survey...")
    request_json("POST", API + f"/surveys/{survey_id}/publish", headers=headers)

    print("Simulating autosave via update...")
    updated = request_json("PUT", API + f"/surveys/{survey_id}", {"survey_json": {"title": "E2E Survey updated", "pages": []}}, headers=headers)
    print("Updated version:", updated.get("version"))

    print("Starting public session...")
    sess = request_json("POST", API + f"/public/surveys/{survey_id}/sessions", {"respondent_id": "e2e_respondent"})
    session_id = sess.get("id")
    print("Session id:", session_id)

    print("Completing session...")
    comp = request_json("POST", API + f"/public/sessions/{session_id}/complete", {"answers_json": {"q1": "answer"}})
    print("Completed:", comp.get("is_completed"))

    print("Fetching session...")
    got = request_json("GET", API + f"/public/sessions/{session_id}")
    print(json.dumps(got, indent=2, ensure_ascii=False))

    print("E2E smoke completed successfully")


if __name__ == "__main__":
    main()
