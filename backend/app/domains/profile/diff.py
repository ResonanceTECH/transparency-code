"""Структурное сравнение снапшотов версий профиля.

Чистые функции: принимают два JSON-снапшота, возвращают список
изменённых путей вида ``{"path": "payments[0].records[1].amount",
"before": ..., "after": ...}``.

В расширенной анкете списки сопоставляются по устойчивому ID, а не позиции.
URL доступа и совместимые SQL-ID не являются изменением сведений.
Для прежних слепков сохраняется совместимое структурное сравнение.
"""

from __future__ import annotations

import copy
from typing import Any

IGNORED_KEYS = frozenset({"id", "created_at", "updated_at", "profile_id", "block_id", "_meta"})


def _path(parent: str, key: str | int) -> str:
    if isinstance(key, int):
        return f"{parent}[{key}]"
    return f"{parent}.{key}" if parent else key


def _walk(before: Any, after: Any, path: str, out: list[dict[str, Any]], *, stable_ids=False) -> None:
    if isinstance(before, dict) and isinstance(after, dict):
        for key in sorted(before.keys() | after.keys()):
            if not stable_ids and key in IGNORED_KEYS:
                continue
            _walk(before.get(key), after.get(key), _path(path, key), out, stable_ids=stable_ids)
        return
    if isinstance(before, list) and isinstance(after, list):
        if stable_ids and all(
            isinstance(row, dict) and isinstance(row.get("id"), str) and row["id"]
            for row in [*before, *after]
        ) and all(len({row["id"] for row in rows}) == len(rows) for rows in (before, after)):
            previous = {row["id"]: row for row in before}
            current = {row["id"]: row for row in after}
            for identity in sorted(previous.keys() | current.keys()):
                _walk(previous.get(identity), current.get(identity), f"{path}[id={identity}]", out,
                      stable_ids=True)
            return
        for index in range(max(len(before), len(after))):
            b = before[index] if index < len(before) else None
            a = after[index] if index < len(after) else None
            _walk(b, a, _path(path, index), out, stable_ids=stable_ids)
        return
    if before != after:
        out.append({"path": path, "before": before, "after": after})


def _questionnaire_content(snapshot: dict) -> dict:
    questionnaire = copy.deepcopy(snapshot["questionnaire"])
    for file in [*questionnaire.get("attachments", []),
                 *([questionnaire["photo"]] if questionnaire.get("photo") else [])]:
        file.pop("url", None)
    additional = questionnaire.get("legacy_data", {})
    collections = [additional.get("service_periods", {}), additional.get("activities", {})]
    collections.extend(additional.get("records", {}).values())
    for rows in collections:
        for row in rows.values():
            row.pop("source_id", None)
    for relative in additional.get("additional_relatives", []):
        relative.pop("id", None)
    return {"questionnaire": questionnaire, "reply": snapshot.get("reply", "")}


def diff_snapshots(before: dict | None, after: dict | None) -> list[dict[str, Any]]:
    """Возвращает список изменений между двумя снапшотами версий."""
    out: list[dict[str, Any]] = []
    if before and after and before.get("questionnaire") and after.get("questionnaire"):
        _walk(_questionnaire_content(before), _questionnaire_content(after), "", out, stable_ids=True)
    else:
        _walk(before or {}, after or {}, "", out)
    return out
