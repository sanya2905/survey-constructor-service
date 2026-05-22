#!/usr/bin/env python3
"""E2E: stats and export endpoints (JSON, CSV, anonymize, include_incomplete).

Usage: python3 scripts/e2e_stats_and_export.py [--api http://localhost:8001/api/v1]
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

    username = f"e2e_stat_{int(time.time())}"
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

    # Create and publish
    print("Creating survey...")
    survey = request_json(
        "POST",
        API + "/surveys",
        {
            "title": "Stats Export Survey",
            "survey_json": {
                "title": "Stats Export Survey",
                "pages": [
                    {
                        "name": "page1",
                        "elements": [
                            {"type": "text", "name": "city", "title": "City"},
                            {"type": "checkbox", "name": "hobbies", "title": "Hobbies"},
                        ],
                    }
                ],
            },
        },
        headers=headers,
    )
    survey_id = survey["id"]
    print("Survey id:", survey_id)

    print("Publishing survey...")
    request_json("POST", API + f"/surveys/{survey_id}/publish", headers=headers)

    # Start and complete two sessions
    for i, respondent in enumerate(["resp_a", "resp_b"]):
        print(f"Session {i+1} for {respondent}...")
        sess = request_json(
            "POST",
            API + f"/public/surveys/{survey_id}/sessions",
            {"respondent_id": respondent},
        )
        sid = sess["id"]
        request_json(
            "POST",
            API + f"/public/sessions/{sid}/complete",
            {"answers_json": {"city": f"City_{respondent}", "hobbies": ["sport"]}},
        )

    # Start incomplete session
    print("Starting incomplete session...")
    inc = request_json(
        "POST",
        API + f"/public/surveys/{survey_id}/sessions",
        {"respondent_id": "resp_incomplete"},
    )
    inc_id = inc["id"]
    request_json(
        "PUT",
        API + f"/public/sessions/{inc_id}",
        {"answers_json": {"city": "Partial"}, "current_page": 0, "progress_pct": 30.0},
    )

    # Stats
    print("Fetching stats...")
    stats = request_json("GET", API + f"/surveys/{survey_id}/stats", headers=headers)
    assert stats["survey_id"] == survey_id
    assert stats["total_sessions"] == 3
    assert stats["completed_sessions"] == 2
    assert stats["in_progress_sessions"] == 1
    assert 0.0 < stats["completion_rate"] <= 1.0
    print("Stats:", stats)

    # Export JSON default (completed only)
    print("Exporting JSON (completed only)...")
    json_exp = request_json("GET", API + f"/surveys/{survey_id}/export?format=json", headers=headers)
    assert len(json_exp) == 2
    print("JSON rows:", len(json_exp))

    # Export JSON with incomplete
    print("Exporting JSON (include incomplete)...")
    json_all = request_json("GET", API + f"/surveys/{survey_id}/export?format=json&include_incomplete=true", headers=headers)
    assert len(json_all) == 3
    print("JSON rows (all):", len(json_all))

    # Export CSV anonymized
    print("Exporting CSV (anonymize)...")
    req = request_json.__wrapped__ if hasattr(request_json, "__wrapped__") else None
    # We'll do a raw request to check CSV body
    import urllib.request as ureq
    url = API + f"/surveys/{survey_id}/export?format=csv&anonymize=true"
    r = ureq.Request(url, headers=headers, method="GET")
    with ureq.urlopen(r, timeout=30) as resp:
        body = resp.read().decode()
    assert "respondent_id" in body
    lines = body.strip().splitlines()
    assert len(lines) == 3  # header + 2 completed rows
    # anonymize=true sets respondent_id to None -> empty field in CSV
    data_lines = lines[1:]
    for dl in data_lines:
        parts = dl.split(",")
        # respondent_id is 3rd column (index 2)
        assert parts[2] == "" or parts[2].lower() == "none", f"Expected anonymized respondent_id, got {parts[2]}"
    print("CSV rows:", len(lines))

    print("Stats and export completed successfully")


if __name__ == "__main__":
    main()
