"""Структурное сравнение снапшотов версий профиля.

Чистые функции: принимают два JSON-снапшота, возвращают список
изменённых путей вида ``{"path": "payments[0].records[1].amount",
"before": ..., "after": ...}``.

Списки сопоставляются по индексу — снапшоты производны от одного
черновика, поэтому порядок элементов стабилен. Технические ключи
(``id``, метки времени) из сравнения исключены: идентификаторы
вложенных записей пересоздаются при сохранении черновика и не несут
смысловой нагрузки для проверяющего.
"""

from __future__ import annotations

from typing import Any

IGNORED_KEYS = frozenset({"id", "created_at", "updated_at", "profile_id", "block_id"})


def _path(parent: str, key: str | int) -> str:
    if isinstance(key, int):
        return f"{parent}[{key}]"
    return f"{parent}.{key}" if parent else key


def _walk(before: Any, after: Any, path: str, out: list[dict[str, Any]]) -> None:
    if isinstance(before, dict) and isinstance(after, dict):
        for key in sorted(before.keys() | after.keys()):
            if key in IGNORED_KEYS:
                continue
            _walk(before.get(key), after.get(key), _path(path, key), out)
        return
    if isinstance(before, list) and isinstance(after, list):
        for index in range(max(len(before), len(after))):
            b = before[index] if index < len(before) else None
            a = after[index] if index < len(after) else None
            _walk(b, a, _path(path, index), out)
        return
    if before != after:
        out.append({"path": path, "before": before, "after": after})


def diff_snapshots(before: dict | None, after: dict | None) -> list[dict[str, Any]]:
    """Возвращает список изменений между двумя снапшотами версий."""
    out: list[dict[str, Any]] = []
    _walk(before or {}, after or {}, "", out)
    return out
