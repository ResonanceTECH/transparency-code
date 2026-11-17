"""Analysis services: снапшот входа и `input_hash` (SPEC.md §7.5).

Формат снапшота — канонический JSON: реквизиты дела + все факты,
отсортированные по `id`. Используется при создании `analysis_runs`
и при вычислении `stale` в cases-домене (зафиксированный шов).
"""

import hashlib
import json
from typing import Any


def compute_input_hash(*, basis: str, year: int, name: str, facts: list[dict[str, Any]]) -> str:
    """SHA-256 канонического снапшота входа анализа.

    `facts` — список сериализованных `FactOut` (`model_dump(mode="json")`);
    внутри сортируются по `id` — порядок выборки из БД не влияет на hash.
    """
    payload = {
        "case": {"basis": basis, "year": year, "name": name},
        "facts": sorted(facts, key=lambda f: f["id"]),
    }
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
