"""Analysis domain (bounded context): детерминированные правила, запуски, сигналы, решения.

Ответственность: реестр правил, `input_hash`, иммутабельные `analysis_runs`,
сигналы с evidence, append-only решения, защита от устаревших данных (SPEC.md §7.5–7.7).
Владеет данными: `analysis_runs`, `signals`, `signal_facts`, `decisions`.
"""
