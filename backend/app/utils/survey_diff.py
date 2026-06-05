"""Helpers to detect survey field changes and build human-readable summaries."""

from __future__ import annotations

import json
from typing import Any


def _normalize(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, sort_keys=True, ensure_ascii=False, default=str)
    return str(value)


def values_equal(old: Any, new: Any) -> bool:
    return _normalize(old) == _normalize(new)


def _survey_json_stats(data: dict | None) -> dict[str, int]:
    if not data:
        return {"pages": 0, "questions": 0}
    pages = data.get("pages") or []
    if not isinstance(pages, list):
        pages = []
    questions = 0
    for page in pages:
        if not isinstance(page, dict):
            continue
        elements = page.get("elements") or []
        if isinstance(elements, list):
            questions += len(elements)
    return {"pages": len(pages), "questions": questions}


def build_survey_json_change(old: dict | None, new: dict | None) -> dict[str, Any]:
    old_stats = _survey_json_stats(old)
    new_stats = _survey_json_stats(new)
    detail: dict[str, Any] = {"action": "structure_changed"}
    if old_stats != new_stats:
        detail["pages"] = {"old": old_stats["pages"], "new": new_stats["pages"]}
        detail["questions"] = {"old": old_stats["questions"], "new": new_stats["questions"]}
    return detail


def compute_field_changes(
    *,
    title: str,
    description: str | None,
    survey_json: dict,
    is_published: bool,
    start_date: Any,
    end_date: Any,
    starts_at: Any,
    ends_at: Any,
    max_responses: int | None,
    allow_anonymous: bool,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Return only fields present in payload that differ from current survey state."""
    changes: dict[str, Any] = {}

    if "title" in payload and not values_equal(title, payload["title"]):
        changes["title"] = {"old": title, "new": payload["title"]}

    if "description" in payload and not values_equal(description, payload["description"]):
        changes["description"] = {"old": description, "new": payload["description"]}

    if "survey_json" in payload and not values_equal(survey_json, payload["survey_json"]):
        changes["survey_json"] = build_survey_json_change(survey_json, payload["survey_json"])

    if "is_published" in payload and is_published != payload["is_published"]:
        changes["is_published"] = {"old": is_published, "new": payload["is_published"]}

    for field in ("start_date", "end_date", "starts_at", "ends_at", "max_responses", "allow_anonymous"):
        if field not in payload:
            continue
        current = locals()[field]
        new_val = payload[field]
        if not values_equal(current, new_val):
            changes[field] = {"old": current, "new": new_val}

    return changes


def compute_changes_from_snapshot(snapshot: dict, current: dict) -> dict[str, Any]:
    """Compare a stored snapshot dict to the current survey state dict."""
    return compute_field_changes(
        title=snapshot.get("title") or "",
        description=snapshot.get("description"),
        survey_json=snapshot.get("survey_json") or {},
        is_published=bool(snapshot.get("is_published", False)),
        start_date=snapshot.get("start_date"),
        end_date=snapshot.get("end_date"),
        starts_at=snapshot.get("starts_at"),
        ends_at=snapshot.get("ends_at"),
        max_responses=snapshot.get("max_responses"),
        allow_anonymous=bool(snapshot.get("allow_anonymous", True)),
        payload=current,
    )


def build_change_summary(changes: dict[str, Any]) -> str:
    if not changes:
        return "Изменение"

    if changes.get("action") == "created":
        return "Анкета создана"
    if changes.get("action") == "published":
        content_keys = {k for k in changes if k not in ("action",)}
        if not content_keys:
            return "Анкета опубликована"
        parts = ["Анкета опубликована"]
        if "survey_json" in changes:
            sj = changes["survey_json"]
            if isinstance(sj, dict) and "questions" in sj:
                q = sj["questions"]
                parts.append(f"структура: {q.get('old', 0)} → {q.get('new', 0)} вопр.")
            else:
                parts.append("изменена структура")
        if "title" in changes:
            parts.append("изменено название")
        return ", ".join(parts)
    if changes.get("action") == "restored":
        from_version = changes.get("from_version")
        if from_version is not None:
            return f"Восстановлена версия v{from_version}"
        return "Восстановлена предыдущая версия"

    parts: list[str] = []
    if "survey_json" in changes:
        sj = changes["survey_json"]
        if isinstance(sj, dict) and "questions" in sj:
            q = sj["questions"]
            parts.append(f"Структура: {q.get('old', 0)} → {q.get('new', 0)} вопр.")
        else:
            parts.append("Изменена структура анкеты")
    if "title" in changes:
        parts.append("Изменено название")
    if "description" in changes:
        parts.append("Изменено описание")
    if "is_published" in changes:
        parts.append("Изменён статус публикации")
    for field, label in (
        ("start_date", "Дата начала приёма"),
        ("end_date", "Дата окончания приёма"),
        ("starts_at", "Начало проведения"),
        ("ends_at", "Окончание проведения"),
        ("max_responses", "Лимит ответов"),
        ("allow_anonymous", "Анонимность"),
    ):
        if field in changes:
            parts.append(label)

    return ", ".join(parts) if parts else "Изменение"
