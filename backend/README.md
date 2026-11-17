# Резонанс · Backend

Серверная часть прототипа «Резонанс» — API для интеграционного интерфейса клиента (`frontend/`, маршрут `/`). Обслуживает дела проверок: документы, извлечённые поля, детерминированный анализ, сигналы, решения специалиста и отчёт.

**Стек:** Python 3.12+ · FastAPI · PostgreSQL · SQLAlchemy 2.x (async) · Alembic · Pydantic v2 · pytest.

> Только синтетические данные. Сервер не принимает юридически значимых решений и не обращается к внешним реестрам, банкам или ИИ-сервисам.

## Документация

- **[SPEC.md](SPEC.md)** — полная спецификация: REST-контракт (16 эндпоинтов `/api/*` + `/api/health` + `/openapi.json`), модель данных PostgreSQL, бизнес-логика (статусы, `stale`-снапшоты, конвейер документов, движок правил, решения), безопасность, env-конфигурация, домен этапа 2 (финансовый профиль) и открытые вопросы.
- Клиентский контракт восстановлен из `frontend/src/app/` и `frontend/tests/flow.spec.ts` — клиент является источником истины.

## Структура

```text
backend/
  SPEC.md               # спецификация — читать первым
  README.md             # этот файл (включая журнал итераций)
  pyproject.toml        # зависимости и настройки инструментов
  .env.example          # шаблон переменных окружения
  app/
    main.py             # create_app: composition root, /openapi.json, обработчики ошибок
    core/               # shared kernel: config, db, deps, base
    platform/           # health и метаданные сервиса
    domains/            # bounded contexts — см. MICROSERVICES.md
      identity/         #   users, sessions, auth: api/schemas/services/models
      cases/            #   дела, статусы, события
      documents/        #   загрузка, pipeline, факты
      analysis/         #   rules, analysis_runs, signals, decisions
      reporting/        #   сборка отчёта (без собственных таблиц)
  MICROSERVICES.md      # карта сервисов, контракты, путь выделения
  alembic/              # миграции (env.py готов; revisions — после поднятия PostgreSQL)
  tests/                # pytest + httpx AsyncClient
  Dockerfile            # python:3.12-slim → сервис backend:8000 (позже)
```

## Запуск (dev)

```bash
cd backend
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -e ".[dev]"
cp .env.example .env
.venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

Проверки: `.venv/bin/python -m pytest` · `.venv/bin/ruff check app tests`.

## Связь с остальным репозиторием

- `frontend/` — клиент; dev-прокси `/api` и `/openapi.json` → `http://127.0.0.1:8000` уже настроен (`frontend/vite.config.ts`).
- `frontend/nginx.conf` — production-прокси на `backend:8000`; `client_max_body_size 6m` рассчитан на файлы ≤ 5 МБ.
- `docs/` — продуктовые отчёты; `ml/` — резерв под ML-часть.
- Корневой `docker-compose.yml` (когда появится) — сервисы `db` (postgres), `backend`, `frontend`.

## Журнал итераций

### Итерация 1 — спецификация (16.11.2026)

- `SPEC.md`: восстановлен полный API-контракт из клиента — 16 эндпоинтов `/api/*`, `/api/health`, `/openapi.json`; форматы ошибок `{detail}` и обязательный JSON во всех ответах.
- Модель данных PostgreSQL (11 таблиц), бизнес-логика: статусы, `stale` через `input_hash`, конвейер документов, движок правил, решения специалиста, события.
- Безопасность, env-конфигурация, критерии приёмки по `flow.spec.ts`, домен этапа 2 (финансовый профиль), 10 открытых вопросов.

### Итерация 2 — каркас сервиса (16.11.2026)

- `pyproject.toml`: FastAPI, SQLAlchemy 2.x async + asyncpg, Alembic, pydantic-settings, python-multipart; dev-зависимости pytest/pytest-asyncio/httpx/ruff.
- `app/core/config.py` — `Settings` из env/`.env` (все переменные SPEC §9); `app/core/db.py` — ленивый async engine и зависимость `get_db` (импорт приложения не требует живой БД).
- `app/main.py` — `create_app()`: роутер `/api`, `openapi_url='/openapi.json'`, `docs_url=None` (Swagger UI отдаёт nginx), обработчики ошибок в формате `{"detail": ...}` включая 500.
- `app/api/health.py` — `GET /api/health` → `{"status": "ok"}`.
- `app/models/base.py` — `DeclarativeBase`; заготовлены пакеты `schemas/`, `services/`, `rules/`, `repositories/`.
- `tests/test_health.py` — 2 теста (health + наличие пути в OpenAPI); `.env.example`, `backend/.gitignore`.
- Проверено: `pytest` 2/2, `uvicorn` + `curl /api/health` и `/openapi.json` — OK.

### Итерация 3 — ORM-модели и миграции (16.11.2026)

- `app/models/`: все 10 таблиц SPEC §6 — `users`, `sessions`, `cases`, `documents`, `facts`, `analysis_runs`, `signals`, `signal_facts`, `decisions`, `case_events`.
- `enums.py`: `Basis`, `DocumentStatus`, `SignalStatus`, `DecisionStatus`, `UserRole` — `sa.Enum(native_enum=False, validate_strings=True)` (VARCHAR+CHECK, переносимо между PG и SQLite).
- `base.py`: `DeclarativeBase` с naming convention для constraints; `JSONType = JSON().with_variant(JSONB(), "postgresql")` — JSONB в PG, JSON в SQLite-тестах.
- Связи: `Case → documents/facts/runs/events`, `AnalysisRun → signals`, `Signal → evidence_links/decisions`, `SignalFact → signal/fact` (composite PK + ordinal), каскады `delete-orphan`/`SET NULL` для `document_id`.
- `alembic/`: `alembic.ini` + async `env.py` (URL из `Settings`, `target_metadata = Base.metadata`) + `script.py.mako`; первая миграция — `alembic revision --autogenerate` при поднятой PostgreSQL.
- `tests/test_models.py`: smoke-граф на `sqlite+aiosqlite` (create_all → user→case→doc→fact→run→signal→decision → selectinload-выборка). Dev-зависимость `aiosqlite`.
- Проверено: `pytest` 3/3, `ruff check` чист, `Base.metadata.tables` — все 10 таблиц.

<|open|>argument key="new_string" type="string"<|sep|>### Итерация 4 — микросервисная декомпозиция: bounded contexts (17.11.2026)

- `app/` перестроен из плоской структуры в доменные модули: `core/` (shared kernel: config, db, deps, base), `platform/` (health), `domains/{identity,cases,documents,analysis,reporting}` — каждый с `api.py`/`schemas.py`/`services.py`/`models.py` по единому шаблону.
- ORM-модели распределены по доменам-владельцам: `identity` → users/sessions; `cases` → cases/case_events; `documents` → documents/facts; `analysis` → analysis_runs/signals/signal_facts/decisions; enum'ы переехали в `models.py` своих доменов. Старые `app/models`, `app/api`, `app/schemas`, `app/services`, `app/rules`, `app/repositories` удалены.
- `core/deps.py` — точка внедрения зависимостей (`get_db`; позже `get_current_user` от identity-сервиса). `main.py` — composition root: монтирует platform + доменные роутеры под `/api`.
- `MICROSERVICES.md`: карта из 6 сервисов с data ownership, shared kernel, синхронные/асинхронные контракты (outbox → брокер), порядок выделения Phase 0–4, чек-лист для новых эндпоинтов.
- `SPEC.md`: дерево структуры обновлено под `domains/`; `app/rules/` → `app/domains/analysis/rules/`; `/api` зафиксирован как v1.
- Проверено: `ruff` чист, `pytest` 3/3, `create_app()` — роуты `/api/health` + `/openapi.json` на месте.

### Итерация 4.5 — секреты (17.11.2026)

- `.env.example` очищен от кредов: `DATABASE_URL` без пароля, `SECRET_KEY` пустой с подсказкой, `DEMO_PASSWORD` убран.
- `app/core/config.py`: убраны дефолтные `postgresql+asyncpg://resonance:resonance@…`, `secret_key="dev-secret-change-me"` — реальные значения только из env/`.env`. `demo_password` оставлен (учебный логин, виден в UI клиента).

**Далее:** auth в `domains/identity` (hashing, sessions, demo-логин, `get_current_user`) → cases CRUD → documents pipeline → analysis/rules → signals/decisions → report → outbox-события.
