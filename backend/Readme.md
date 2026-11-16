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
    main.py             # create_app: роутеры /api/*, /openapi.json, обработчики ошибок
    core/               # config (pydantic-settings), db (async engine + get_db)
    api/                # routers: health, … (auth, cases, … — по мере итераций)
    schemas/            # Pydantic DTO
    models/             # SQLAlchemy-модели (Base)
    repositories/       # доступ к данным
    services/           # use-cases: cases, documents pipeline, analysis, demo data, report, events
    rules/              # детерминированный реестр правил анализа
  alembic/              # миграции (появится с моделями)
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

**Далее:** ORM-модели и Alembic-миграции (SPEC §6) → auth (sessions, demo-логин) → cases CRUD → documents → analysis/rules → signals/decisions → report.
