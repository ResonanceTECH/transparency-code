# Резонанс · backend

Серверная часть прототипа «Резонанс». REST API на `/api` для единого интерфейса финансового профиля, контракт `questionnaire-v1`. Анкета, оригиналы файлов, версии, оценки, решения, переписка и журнал хранятся на сервере в базе и `UPLOAD_DIR`. Серверные API прежнего контура дел и документного анализа сохранены вместе с данными, отдельного клиента у них больше нет.

**Стек.** Python 3.12+, FastAPI, SQLAlchemy 2.x async, Alembic, Pydantic v2, PostgreSQL 16. Для локального запуска и тестов подходит SQLite через `aiosqlite`.

> Только синтетические данные. Сервер не обращается к внешним реестрам, банкам или ИИ-сервисам и не принимает юридически значимых решений. Итог по каждому материалу фиксирует проверяющий.

## Структура

```text
backend/
  SPEC.md               # полная спецификация API, данных и бизнес-логики, читать первым
  pyproject.toml        # зависимости, pytest и ruff
  app/
    main.py             # create_app: composition root, openapi, обработчики ошибок, сид демо-аккаунтов
    core/               # shared kernel: config, db, deps, схемы ошибок
    platform/           # GET /api/health и метаданные сервиса
    domains/            # bounded contexts, карта выделения в MICROSERVICES.md
      identity/         #   пользователи, серверные сессии, вход и выход
      profile/          #   серверный профиль: версии, файлы, сигналы, решения, назначения, аудит
      cases/            #   дела проверок и события (прежний контур)
      documents/        #   загрузка, конвейер извлечения, факты (прежний контур)
      analysis/         #   детерминированные правила, запуски, сигналы, решения
      reporting/        #   сборка отчета по делу
  alembic/              # миграции, применяются при старте контейнера
  tests/                # pytest + httpx AsyncClient, in-memory SQLite
  Dockerfile            # python:3.12-slim, сервис backend:8000
```

## API в двух словах

- `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/auth/session`. HttpOnly cookie `session`, argon2id для паролей.
- `/api/profile*`. Черновик резервиста с ревизиями, комплектность, документы, отправка версии, переписка, аудит.
- `/api/reviewer*`. Очередь назначенных материалов, слепок версии, оценки документов, решения по сигналам, итоговое решение, экспорт.
- `/api/reference/*`. Справочники и реестр детерминированных правил.
- Прежний контур дел. `/api/cases*`, `/api/cases/{id}/documents*`, `/api/analysis*`, отчет по делу.
- `GET /api/health`, `GET /openapi.json`. Интерактивный Swagger отдает nginx на `/docs/`.

Полный контракт, модель данных и бизнес-правила описаны в [SPEC.md](SPEC.md), текущая интеграция в [отчете по API](../docs/reports/api-integration-2026-11-20.md).

## Запуск

Из корня репозитория весь стек поднимается через Docker, смотрите [корневой README](../README.md). Отдельно backend для разработки поднимается так.

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
export DATABASE_URL='sqlite+aiosqlite:///./demo-local.db'
export UPLOAD_DIR='./uploads'
export ENVIRONMENT='development'
export ALLOW_DEMO_LOGIN='true'
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Проверка `curl http://127.0.0.1:8000/api/health`. Для существующей базы сначала резервная копия и сверка истории миграций, `alembic stamp` вслепую не применять.

## Переменные окружения

| Переменная | Назначение | Значение по умолчанию |
|---|---|---|
| `DATABASE_URL` | строка подключения SQLAlchemy | `postgresql+asyncpg://resonance@localhost:5432/resonance` |
| `SECRET_KEY` | ключ подписи сессий | пусто, заполнить в `.env` |
| `UPLOAD_DIR` | каталог оригиналов файлов | `./uploads` |
| `ENVIRONMENT` | `development` или `production`, влияет на Secure-флаг cookie | `development` |
| `ALLOW_DEMO_LOGIN` | создавать учебные аккаунты при старте | `true` |
| `DEMO_PASSWORD` | пароль учебных аккаунтов | `resonance-demo-2026` |
| `SESSION_TTL_HOURS` | время жизни сессии | `12` |
| `MAX_UPLOAD_MB` | лимит размера файла | `5` |
| `LOG_LEVEL` | уровень логов | `INFO` |

Демо-аккаунты `reservist`, `reviewer`, `demo` создаются только если их еще нет, существующие имена, роли и пароли при старте не меняются. В production задавать `ALLOW_DEMO_LOGIN=false`.

## Тесты и проверки

```bash
.venv/bin/python -m pytest -q              # весь набор, in-memory SQLite
.venv/bin/python -m ruff check app tests alembic
.venv/bin/python -m compileall -q app alembic
.venv/bin/python -m alembic check          # схема БД совпадает с миграциями
```

Состояние на 22.11.2026. **70 passed, 0 failed**.

| Файл | Тестов | Что покрывает |
|---|---|---|
| `tests/test_health.py` | 2 | health-эндпоинт и наличие пути в OpenAPI |
| `tests/test_models.py` | 1 | smoke-граф ORM-моделей |
| `tests/test_auth.py` | 9 | вход, сессии, границы доступа, идемпотентный сид аккаунтов |
| `tests/test_cases.py` | 9 | дела, нумерация, валидация, изоляция владельца, события |
| `tests/test_documents.py` | 9 | загрузка, дедуп по sha256, извлечение фактов, ошибки форматов |
| `tests/test_analysis.py` | 11 | реестр правил, запуски анализа, сигналы, решения, отчет |
| `tests/test_profile.py` | 22 | контур профиля, роли, версии, ревизии, сигналы, переписка, аудит, закрытие |
| `tests/test_persistent_profile_contract.py` | 7 | контракт `questionnaire-v1`, пустой профиль, ревизии, демо-заполнение, файлы, версии решений |

Тесты работают на изолированной базе в памяти с `ALLOW_DEMO_LOGIN=false` и отдельным `UPLOAD_DIR`, рабочую базу и файлы не затрагивают. Прежние версии `test_auth.py` и `test_profile.py` под старый контракт сохранены в `tests/archive/*.py.txt` и pytest не собираются. Разбор последнего прогона в [отчете](../docs/reports/test-run-2026-11-20.md), UI-тесты описаны в [frontend/README.md](../frontend/README.md).

## Миграции

`alembic upgrade head` применяет все ревизии, в Docker это делает backend при старте. Актуальная цепочка включает миграцию `c72f6a904e11` постоянного хранения анкеты. Перед обновлением существующего развертывания сделать резервную копию базы и `UPLOAD_DIR`. Если таблицы созданы без `alembic_version`, сначала строгая сверка схемы с соответствующей миграцией, подробности в [отчете по API](../docs/reports/api-integration-2026-11-20.md).

## Связанные документы

- [Корневой README](../README.md). Продукт, роли, сценарий, запуск стека.
- [frontend/README.md](../frontend/README.md). Клиент, прокси `/api` на порт 8000 уже настроен в `vite.config.ts` и `nginx.conf`.
- [docs/README.md](../docs/README.md). Отчеты, примеры и скриншоты.
- [SPEC.md](SPEC.md). Полная спецификация. [MICROSERVICES.md](MICROSERVICES.md). Карта доменов и путь выделения сервисов.
- [Журнал итераций backend](../docs/reports/archive/backend-iterations-journal.md). История разработки по итерациям.
