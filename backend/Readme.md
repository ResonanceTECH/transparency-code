# Резонанс · Backend

Серверная часть прототипа «Резонанс» — API для интеграционного интерфейса клиента (`frontend/`, маршрут `/`). Обслуживает дела проверок: документы, извлечённые поля, детерминированный анализ, сигналы, решения специалиста и отчёт.

**Стек (план):** Python 3.12+ · FastAPI · PostgreSQL · SQLAlchemy 2.x · Alembic · pytest.

> Только синтетические данные. Сервер не принимает юридически значимых решений и не обращается к внешним реестрам, банкам или ИИ-сервисам.

## Документация

- **[SPEC.md](SPEC.md)** — полная спецификация: REST-контракт (16 эндпоинтов `/api/*` + `/api/health` + `/openapi.json`), модель данных PostgreSQL, бизнес-логика (статусы, `stale`-снапшоты, конвейер документов, движок правил, решения), безопасность, env-конфигурация, домен этапа 2 (финансовый профиль) и открытые вопросы.
- Клиентский контракт восстановлен из `frontend/src/app/` и `frontend/tests/flow.spec.ts` — клиент является источником истины.

## Структура (планируемая)

```text
backend/
  SPEC.md               # спецификация — читать первым
  README.md             # этот файл
  pyproject.toml        # зависимости и скрипты (появится с реализацией)
  app/
    main.py             # FastAPI app, роутеры /api/*, /openapi.json
    core/               # config, security (сессии, хэширование), errors
    api/                # routers: auth, cases, documents, facts, analysis, signals, rules, reports, health
    schemas/            # Pydantic DTO
    models/             # SQLAlchemy-модели
    repositories/       # доступ к данным
    services/           # use-cases: cases, documents pipeline, analysis, demo data, report, events
    rules/              # детерминированный реестр правил анализа
  alembic/              # миграции
  tests/                # unit + contract tests
  Dockerfile            # python:3.12-slim → сервис backend:8000
```

## Связь с остальным репозиторием

- `frontend/` — клиент; dev-прокси `/api` и `/openapi.json` → `http://127.0.0.1:8000` уже настроен (`frontend/vite.config.ts`).
- `frontend/nginx.conf` — production-прокси на `backend:8000`; `client_max_body_size 6m` рассчитан на файлы ≤ 5 МБ.
- `docs/` — продуктовые отчёты; `ml/` — резерв под ML-часть.
- Корневой `docker-compose.yml` (когда появится) — сервисы `db` (postgres), `backend`, `frontend`.

## Статус

Документация и контракт зафиксированы (SPEC.md v1.0). Код сервисной части ещё не реализован — следующий шаг: `pyproject.toml`, скелет FastAPI-приложения, модели и миграции по SPEC.md.
