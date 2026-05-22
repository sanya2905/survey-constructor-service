#!/usr/bin/env python3
"""E2E: public respondent flow — start, save progress, complete, verify.

Usage: python3 scripts/e2e_public_flow.py [--api http://localhost:8001/api/v1]
"""
import sys
import time
import argparse

from e2e_lib import request_json, wait_for_api, login, register_user, auth_headers


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api", default="http://localhost:8001/api/v1")
    args = p.parse_args()
    API = args.api.rstrip("/")

    print("Waiting for API...")
    if not wait_for_api(API):
        print("API did not become ready", file=sys.stderr)
        sys.exit(2)

    username = f"e2e_pub_{int(time.time())}"
    password = "password"
    email = f"{username}@example.test"

    print("Registering admin", username)
    register_user(API, username, password, email, role="admin")

    print("Logging in...")
    token = login(API, username, password)
    if not token:
        print("Login failed", file=sys.stderr)
        sys.exit(3)
    headers = auth_headers(token)

    # Create and publish survey
    print("Creating survey...")
    survey = request_json(
        "POST",
        API + "/surveys",
        {
            "title": "Public Flow Survey",
            "survey_json": {
                "title": "Public Flow Survey",
                "pages": [
                    {
                        "name": "page1",
                        "elements": [
                            {"type": "text", "name": "name", "title": "Your name"},
                            {"type": "text", "name": "age", "title": "Your age"},
                        ],
                    },
                    {
                        "name": "page2",
                        "elements": [
                            {"type": "checkbox", "name": "interests", "title": "Interests"}
                        ],
                    },
                ],
            },
        },
        headers=headers,
    )
    survey_id = survey["id"]
    print("Survey id:", survey_id)

    print("Publishing survey...")
    request_json("POST", API + f"/surveys/{survey_id}/publish", headers=headers)

    # Start session
    print("Starting session...")
    sess = request_json(
        "POST",
        API + f"/public/surveys/{survey_id}/sessions",
        {"respondent_id": "respondent_42"},
    )
    session_id = sess["id"]
    assert sess["is_completed"] is False
    assert sess["progress_pct"] == 0.0
    print("Session id:", session_id)

    # Save progress (page 1)
    print("Saving progress page 1...")
    saved = request_json(
        "PUT",
        API + f"/public/sessions/{session_id}",
        {"answers_json": {"name": "Alice", "age": "30"}, "current_page": 1, "progress_pct": 50.0},
    )
    assert saved["current_page"] == 1
    assert saved["progress_pct"] == 50.0
    assert saved["answers_json"]["name"] == "Alice"
    print("Progress saved, page:", saved["current_page"])

    # Save progress (page 2)
    print("Saving progress page 2...")
    saved2 = request_json(
        "PUT",
        API + f"/public/sessions/{session_id}",
        {"answers_json": {"name": "Alice", "age": "30", "interests": ["music", "hiking"]}, "current_page": 2, "progress_pct": 100.0},
    )
    print("Progress saved, page:", saved2["current_page"])

    # Complete
    print("Completing session...")
    completed = request_json(
        "POST",
        API + f"/public/sessions/{session_id}/complete",
        {"answers_json": {"name": "Alice", "age": "30", "interests": ["music", "hiking"]}},
    )
    assert completed["is_completed"] is True
    assert completed["progress_pct"] == 100.0
    print("Completed:", completed["is_completed"])

    # Verify via get
    print("Fetching completed session...")
    got = request_json("GET", API + f"/public/sessions/{session_id}")
    assert got["is_completed"] is True
    assert got["answers_json"]["name"] == "Alice"
    print("Verified session completion")

    # Verify admin sees the session
    print("Listing sessions as admin...")
    sessions = request_json("GET", API + f"/surveys/{survey_id}/sessions", headers=headers)
    session_ids = [s["id"] for s in sessions]
    assert session_id in session_ids
    print("Admin sees session:", session_id)

    print("Public flow completed successfully")


if __name__ == "__main__":
    main()
