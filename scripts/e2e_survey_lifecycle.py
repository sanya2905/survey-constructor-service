#!/usr/bin/env python3
"""E2E: full survey CRUD lifecycle including list, get, update, publish, delete.

Usage: python3 scripts/e2e_survey_lifecycle.py [--api http://localhost:8001/api/v1]
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

    username = f"e2e_crud_{int(time.time())}"
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

    # Create
    print("Creating survey...")
    payload = {
        "title": "CRUD Survey",
        "description": "Created by e2e_survey_lifecycle",
        "survey_json": {
            "title": "CRUD Survey",
            "pages": [
                {"name": "page1", "elements": [{"type": "text", "name": "q1", "title": "Q1"}]}
            ],
        },
    }
    created = request_json("POST", API + "/surveys", payload, headers=headers)
    survey_id = created.get("id")
    assert survey_id, f"Expected survey id, got {created}"
    print("Survey id:", survey_id)

    # List
    print("Listing surveys...")
    listed = request_json("GET", API + "/surveys", headers=headers)
    ids = [s["id"] for s in listed]
    assert survey_id in ids, f"Expected created survey in list, got {ids}"
    print("Listed count:", len(listed))

    # Get
    print("Getting survey...")
    got = request_json("GET", API + f"/surveys/{survey_id}", headers=headers)
    assert got["id"] == survey_id
    assert got["title"] == "CRUD Survey"
    assert got["is_published"] is False
    print("Got title:", got["title"])

    # Update
    print("Updating survey...")
    updated = request_json(
        "PUT",
        API + f"/surveys/{survey_id}",
        {"title": "CRUD Survey Updated", "description": "Updated desc"},
        headers=headers,
    )
    assert updated["title"] == "CRUD Survey Updated"
    assert updated["description"] == "Updated desc"
    print("Updated title:", updated["title"])

    # Publish
    print("Publishing survey...")
    published = request_json("POST", API + f"/surveys/{survey_id}/publish", headers=headers)
    assert published["is_published"] is True
    print("Published:", published["is_published"])

    # Get public survey
    print("Getting public survey...")
    pub = request_json("GET", API + f"/public/surveys/{survey_id}")
    assert pub["id"] == survey_id
    assert pub["title"] == "CRUD Survey Updated"
    print("Public title:", pub["title"])

    # Delete
    print("Deleting survey...")
    request_json("DELETE", API + f"/surveys/{survey_id}", headers=headers, expect_status=204)
    print("Deleted")

    # Verify deletion
    print("Verifying deletion...")
    deleted_list = request_json("GET", API + "/surveys", headers=headers)
    ids_after = [s["id"] for s in deleted_list]
    assert survey_id not in ids_after, f"Expected survey {survey_id} deleted"
    print("Survey lifecycle completed successfully")


if __name__ == "__main__":
    main()
