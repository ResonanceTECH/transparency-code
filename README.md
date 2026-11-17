# Резонанс

Прототип цифрового финансового профиля резервиста (хакатон, направление № 6). Клиент и API для проверки сведений: дела проверок, документы, извлечённые факты, детерминированный анализ, сигналы, решения специалиста и отчёт. Только вымышленные данные; решения принимает уполномоченный специалист, система юридически значимых выводов не делает.

## Запуск в Docker (весь стек)

```bash
cp .env.example .env   # заполнить POSTGRES_PASSWORD и SECRET_KEY
docker compose up -d --build
```

Поднимаются три сервиса: `db` (PostgreSQL 16), `backend` (FastAPI, миграции применяются при старте) и `frontend` (nginx + собранный SPA). Порт фронта задаётся `HTTP_PORT` (по умолчанию 80).

## Как войти

- Приложение: **http://localhost:8080** (или `http://localhost`, если `HTTP_PORT` не задан)
- Логин: **`demo`** · пароль: **`resonance-demo-2026`** — демо-аккаунт сидируется при старте (`ALLOW_DEMO_LOGIN=true`, только для учебного контура)
- Swagger UI: **http://localhost:8080/docs** или **/swagger**
- Проверка API: `curl http://localhost:8080/api/health` → `{"status":"ok"}`

## Структура репозитория

```text
transparency-code/
  frontend/   # React 19 + TypeScript + Vite — клиент (интеграционный UI + макет /prototype)
  backend/    # FastAPI + PostgreSQL — серверная часть (см. backend/SPEC.md)
  docs/       # Отчёты и скриншоты
  ml/         # Резерв под ML-часть
```

- **Frontend:** [frontend/README.md](frontend/README.md) — запуск `npm ci && npm run dev:prototype`, тесты Playwright.
- **Backend:** [backend/README.md](backend/README.md) и [backend/SPEC.md](backend/SPEC.md) — спецификация API и данных.

## Быстрый старт без Docker (frontend-макет)

```bash
cd frontend
npm ci
npm run dev:prototype   # макет на http://127.0.0.1:4173/prototype, без бэкенда
npm run dev             # интеграционный UI на :5173 (нужен backend на :8000)
```
