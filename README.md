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

## CI/CD (GitHub Actions)

Все workflows лежат в `.github/workflows/` и срабатывают только по релевантным путям:

| Workflow | Триггер | Что делает |
|---|---|---|
| `frontend-ci.yml` | push/PR, `frontend/**` | `npm ci` → typecheck → build → Playwright-тесты макета |
| `backend-ci.yml` | push/PR, `backend/**` | ruff + pytest; отдельный job: миграции на реальном PostgreSQL (`alembic upgrade head` + `alembic check`) |
| `e2e.yml` | push в `main` и PR | собирает весь стек docker compose и гоняет `frontend/tests/flow.spec.ts` против `127.0.0.1:8080` |
| `cd.yml` | push в `main` | собирает и пушит образы `backend`/`frontend` в GHCR (`latest` + `sha-*` + `main`) |

Образы: `ghcr.io/resonancetech/transparency-code-backend` и `ghcr.io/resonancetech/transparency-code-frontend` — на любом сервере развёртывание сводится к `docker compose pull` + `up` (или `docker run` с env из `.env.example`).

## Автодеплой на сервер (Watchtower)

`docker-compose.prod.yml` поднимает тот же стек на готовых образах из GHCR и сервис [Watchtower](https://containrrr.dev/watchtower/): раз в 60 секунд он опрашивает реестр и, если образ `:latest` обновился, сам пересоздаёт контейнеры `backend`/`frontend`. То есть после настройки deploy = `git push` в `main` → `cd.yml` собирает и пушит образы → сервер подтягивает их в течение минуты.

На сервере (разово):

```bash
# 1. Если пакеты GHCR приватные — залогиниться в реестр:
#    docker login ghcr.io -u <github-логин> -p <PAT со scope read:packages>
#    (либо просто указать GHCR_USER/GHCR_TOKEN в .env — их подхватит Watchtower)

# 2. Код на сервере не нужен — только compose-файл и .env
cp .env.example .env   # заполнить POSTGRES_PASSWORD, SECRET_KEY (+ GHCR_* при необходимости)

# 3. Запуск
docker compose -f docker-compose.prod.yml up -d
```

Проверка: `docker compose -f docker-compose.prod.yml ps` — четыре сервиса (`db`, `backend`, `frontend`, `watchtower`); логи автообновлений: `docker logs -f <проект>-watchtower-1`.

Нюансы:

- `db` (postgres) под Watchtower не подписан — базу обновляем вручную (`docker compose -f docker-compose.prod.yml pull db && up -d db`).
- В момент обновления backend'а возможны кратковременные 502 на фронте (nginx перечитывает DNS при рестарте; Watchtower пересоздаёт frontend следом).
- Если на сервере нет доступа к GHCR, prod-файл умеет собирать локально: в нём сохранены `build:` — `docker compose -f docker-compose.prod.yml up -d --build`.
