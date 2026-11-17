# Резонанс · full stack

Рабочий синтетический прототип цифрового финансового профиля резервиста: React + FastAPI + PostgreSQL.

**Только вымышленные данные.** Прототип не заменяет «Справки БК», официальную проверку или юридическое заключение.

## Состав

```text
frontend/   React 19 + TypeScript + Vite — макет /prototype и интеграционный UI
backend/    FastAPI + PostgreSQL — API, документы, правила, версии, аудит
docs/       отчёты и скриншоты
.github/    CI: backend, frontend, e2e
```

## Запуск через Docker

```bash
cp .env.example .env
docker compose up -d --build --wait
```

Открыть http://localhost:8080. Swagger: http://localhost:8080/docs.

Учебные аккаунты — пароль `resonance-demo-2026`:

| Логин | Роль |
|---|---|
| `demo` | специалист, контур дел |
| `reservist` | резервист, профиль и версии |
| `reviewer` | проверяющий, карточки и решения |

## Локальная разработка

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\python.exe -m pip install -e ".[dev]"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Vite проксирует `/api` и `/openapi.json` на `127.0.0.1:8000`. Макет с ролями через API доступен по `/prototype`.

## Тесты

```bash
cd backend && .venv\Scripts\python.exe -m pytest -q && .venv\Scripts\python.exe -m ruff check app tests alembic
cd ../frontend && npm run typecheck && npm run build && npm run test:prototype && npm run test:visual
```

Интеграционные тесты `npm run test:e2e` запускает CI через `docker compose` на порту 8080.

## Артефакты

Синтетические PDF и данные: `frontend/public/samples`. Пересоздание: `python tools/generate_samples.py` из папки `frontend`.

В выгрузку не включены: `node_modules`, `.venv`, `dist`, `test-results`, `.env`, базы данных и загруженные файлы.
