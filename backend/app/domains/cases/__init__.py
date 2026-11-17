"""Cases domain (bounded context): дела проверок, их жизненный цикл и лента событий.

Ответственность: CRUD дел, статусы, `stale`/`pending_count`, audit-лента (SPEC.md §5, §7).
Владеет данными: `cases`, `case_events`.
"""
