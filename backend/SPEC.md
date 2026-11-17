# «Резонанс» — спецификация серверной части

Версия 1.2 · 17.11.2026 · статус: требования к реализации (этап 1 в работе, этап 2 детализирован)

Документ фиксирует, что должна реализовывать серверная часть, на основе анализа клиентского кода (`frontend/`) и продуктовых материалов команды. Клиент — источник истины по контракту этапа 1: все эндпоинты, схемы данных и сценарии разделов 3–9 восстановлены из `frontend/src/app/` (`api.ts`, `types.ts`, `AppShell`/views), `frontend/tests/flow.spec.ts`, `frontend/vite.config.ts` и `frontend/nginx.conf`. Источник истины этапа 2 (раздел 10) — макет `frontend/src/profile/` и документы «Проект ролей и функций», «Роли и функции + ввод данных», «Интерфейс», «Паспорт проекта Резонанс».

---

## 1. Назначение и границы продукта

«Резонанс» — прототип поддержки предварительного анализа полноты и достоверности представленных сведений (направление № 6 хакатона). Сервер реализует **интеграционный режим** клиента (`/`): дела проверок, документы, извлечённые поля, детерминированный анализ, сигналы, решения специалиста, отчёт.

Жёсткие рамки:

- **Только синтетические данные.** Сервер не предназначен для реальных персональных данных; все демо-комплекты и аккаунты — вымышленные.
- **Детерминизм.** Никакого внешнего ИИ, обращений к реестрам, Госуслугам, банкам. Анализ — набор воспроизводимых правил над структурированными полями.
- **Человек принимает решение.** Система формирует сигналы и хранит решения специалиста; юридически значимых выводов не делает.
- **Ограниченный конвейер документов.** JSON/XLSX и текстовые PDF/DOCX по учебному шаблону. Произвольные справки БК, сканы и OCR не поддерживаются.

Второй клиентский интерфейс (`/prototype`, финансовый профиль резервиста) сейчас работает полностью в памяти и API не требует. Его целевой домен описан в разделе 10 — он станет следующим этапом сервера.

## 2. Целевой стек и место в репозитории

| Компонент | Технология | Основание |
|---|---|---|
| Язык/рантайм | Python 3.12+, Uvicorn | указано в модалке «О системе»: «React + FastAPI + PostgreSQL» |
| Web-фреймворк | FastAPI + Pydantic v2 | генерация `/openapi.json`, валидация, async I/O |
| БД | PostgreSQL 16 + SQLAlchemy 2.x + Alembic | указано клиентом; реляционная модель с историей запусков |
| Файлы | локальный том `UPLOAD_DIR` | nginx `client_max_body_size 6m`, файлы ≤ 5 МБ |
| Тесты | pytest + httpx (AsyncClient) | e2e уже есть на клиенте (`flow.spec.ts`) |
| Доставка | Docker `python:3.12-slim`, сервис `backend:8000` | `frontend/nginx.conf` проксирует на `backend:8000` |

```
transparency-code/
  frontend/   # React-клиент (готов, перенесён)
  backend/    # этот сервис
    app/
      main.py            # FastAPI app: composition root, роутеры /api/*, /openapi.json
      core/              # shared kernel: config, db, deps (auth), base (ORM)
      platform/          # health и метаданные сервиса
      domains/           # bounded contexts — см. MICROSERVICES.md
        identity/        #   users, sessions, auth → api/schemas/services/models
        cases/           #   дела, статусы, события
        documents/       #   загрузка, pipeline, факты
        analysis/        #   rules, analysis_runs, signals, decisions
        reporting/       #   сборка отчёта (без собственных таблиц)
    alembic/             # миграции
    tests/               # unit + contract tests
    Dockerfile
    pyproject.toml
  docs/                  # отчёты и скриншоты (уже есть)
  ml/                    # резерв под ML-часть (пока пусто)
```

> Структура `app/domains/` реализована (итерация 4); карта сервисов, контракты
> и порядок выделения в самостоятельные сервисы — в [MICROSERVICES.md](MICROSERVICES.md).

Сетевое окружение: `frontend` (nginx) → `backend:8000` → `db:5432`. В dev-режиме Vite проксирует `/api` и `/openapi.json` на `http://127.0.0.1:8000`.

## 3. Транспорт и соглашения

- **Префикс.** Все прикладные эндпоинты живут под `/api` (nginx `location /api/` проксирует URI без изменений; Vite-прокси тоже сохраняет путь). Префикс `/api` ≡ версия v1; версионирование `/api/v2` — при ломающих изменениях (см. MICROSERVICES.md §4).
- **Формат.** JSON in / JSON out. `Content-Type: application/json` для всех тел, кроме multipart-загрузки файлов (`FormData`, поле `file`).
- **Критично:** клиентский `api()` всегда вызывает `response.json()`. **Любой ответ должен быть валидным JSON** — включая `POST /auth/logout`, `POST /cases/:id/demo`, `POST /cases/:id/confirm-facts`, `POST /cases/:id/analysis-runs`. Пустое тело или `204` сломают клиент. Для «пустых» операций возвращать `200` + `{}` или `{"ok": true}`.
- **Ошибки.** Единый формат `{"detail": "<человекочитаемое сообщение на русском>"}` (совместимо с FastAPI `HTTPException`). Клиент маппит: `401` → сброс сессии; `422` → «Проверьте обязательные поля, формат дат и значений.»; прочие → «Запрос не выполнен. Проверьте подключение к серверу.» Доменные ошибки должны возвращать `detail` строкой; ошибки валидации Pydantic могут оставаться стандартными (массив `detail`).
- **Время.** `created_at` — ISO 8601 UTC с `Z` (клиент дописывает `Z` при отсутствии, но лучше отдавать сразу с зоной). Pydantic `datetime` сериализуется с офсетом — приводить к UTC.
- **Маппинг имён полей API ↔ БД** (клиент ждёт именно эти имена): `Fact.date` ← `facts.fact_date`; `Fact.document_name` ← `documents.filename` (join, `""` если документа нет); `Signal.rule` ← `signals.rule_id`; `Document.name` ← `documents.filename`.
- **OpenAPI-гигиена.** Каждый эндпоинт: `response_model`, явный `status_code`, русский `summary`/docstring, тег домена (`identity`, `cases`, `documents`, `analysis`, `reporting`, `platform`). Ошибки `4xx` документируются в `responses={}` где неочевидно (401/404/409). Цель — Swagger читается как контракт без чтения кода.
- **Скачивание файлов** — единственный не-JSON ответ: `GET /api/cases/{id}/documents/{doc_id}` возвращает байты с `Content-Disposition: attachment` (клиент ходит по прямой ссылке `<a href>`, не через `api()`).
- **Swagger.** `GET /openapi.json` — стандартный FastAPI; `GET /docs` обслуживается nginx из `frontend/public/docs` (офлайн Swagger UI), backend ничего для него делать не должен, кроме корректного OpenAPI.

## 4. Аутентификация и сессии

Модель — одна или несколько учётных записей специалистов; клиент рассчитан на cookie-сессию (`credentials: 'same-origin'`).

- `POST /api/auth/login` `{username, password}` → `200 {"username": "..."}` + `Set-Cookie: session=<token>; HttpOnly; SameSite=Lax; Path=/; Secure(за TLS-прокси)`. При неверных реквизитах — `401 {"detail": "Неверный логин или пароль"}`.
- `GET /api/auth/me` → `200 {"username": "..."}` при валидной сессии, иначе `401 {"detail": "Требуется вход"}`. Клиент вызывает при старте; `401` → экран логина.
- `POST /api/auth/logout` → `200 {}` + очистка cookie/сессии в БД.
- Пароли — argon2id или bcrypt; в БД только хэш.
- Сессии — серверная таблица `sessions` (токен, `user_id`, `created_at`, `expires_at`) с TTL (например, 12 ч) и продлением при активности. Токен — `secrets.token_urlsafe(32)`, в cookie только токен.
- **Демо-аккаунт по умолчанию:** `demo / resonance-demo-2026` (клиент подставляет в форму и упоминает в подсказке). Реквизиты — из env (`DEMO_USERNAME`, `DEMO_PASSWORD`), при старте сервис создаёт/обновляет demo-пользователя идемпотентно. На проде демо-логин отключаем (`ALLOW_DEMO_LOGIN=false`).
- Все эндпоинты, кроме `/api/auth/login`, `/api/health`, `/openapi.json`, требуют валидной сессии → иначе `401`. Клиент при любом `401` сбрасывает состояние.

## 5. REST API — полный контракт

Нотация: `→` запрос → ответ. Все пути с префиксом `/api`. `«auth»` — требуется сессия.

### 5.1 Служебные

| Метод и путь | Назначение | Ответ |
|---|---|---|
| `GET /api/health` | healthcheck (есть в OpenAPI, проверяется тестом) | `200 {"status": "ok"}` |
| `GET /openapi.json` | схема API (FastAPI default, **без** `/api`) | OpenAPI 3.x |

### 5.2 Аутентификация — см. раздел 4.

### 5.3 Дела (cases)

**`GET /api/cases`** → `CaseSummary[]` — реестр дел текущего пользователя, отсортирован по `created_at DESC`. Используется дашбордом, реестром и после каждой мутации (`refresh()`).

```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "number": "PR-2026-0007",
    "name": "Соколова Елена · вымышленное лицо",
    "department": "Учебное подразделение",
    "basis": "candidate",
    "year": 2025,
    "created_at": "2026-11-16T10:42:00Z",
    "signals_count": 2,
    "pending_count": 2,
    "status": "attention",
    "stale": false
  }
]
```

`status ∈ {"draft","attention","completed"}` — вычисляемая семантика (раздел 7.1): `draft` — нет ни одного запуска; `attention` — последний запуск содержит ожидающие сигналы (`pending_count > 0`); `completed` — последний запуск есть и `pending_count = 0` (включая запуск с 0 сигналов). `stale` — вычисляемый флаг (7.2). `signals_count` — число сигналов последнего запуска. `owner_id` — изоляция: пользователь видит только свои дела; чужой `id` → `404` (не `403`, чтобы не раскрывать существование).

**`POST /api/cases`** — создание дела. Тело (клиент шлёт из формы «Новая проверка» и из демо-сценариев):

```json
{ "synthetic": true, "name": "Иванов Алексей · вымышленное лицо", "department": "Учебное подразделение", "basis": "candidate", "year": 2025 }
```

- `basis ∈ {"candidate","expense_review"}`; `name` 2–200 симв.; `department` ≤ 200 (клиент подставляет «Учебное подразделение» при пустом); `year` 2000–2100; `synthetic` должен быть `true` — сервер отклоняет `false` (`422`) до появления реального контура.
- `→ 201/200 CaseSummary` (клиент использует `id` для перехода к документам).
- Номер `number` генерирует сервер: `PR-<year>-<seq:04d>`, последовательность — **внутри года** дела (`year` из запроса), атомарно под блокировкой строки/sequence. Пример: `PR-2025-0001`. Клиент парсит только имя файла отчёта.
- `→ 201 CaseSummary`. Побочный эффект: событие `case_events` в формате «Короткое: детали» — `«Дело создано: {name}»` (клиент показывает `message.split(':')[0]` как заголовок — формат с двоеточием обязателен).

**`GET /api/cases/{id}`** → `CaseDetail` — карточка дела: summary + `facts[]`, `documents[]`, `runs[]` (полные, с `signals[].evidence[]` и `signals[].decisions[]`), `events[]`. `404` при чужом/несуществующем id.

```jsonc
{
  "...CaseSummary поля...": "",
  "facts": [
    {
      "id": "…", "document_id": "…", "document_name": "trade_in.json",
      "field": "sale_amount", "label": "Доход от продажи в справке",
      "value": "1450000", "object_id": "trade-in-car",
      "date": "2025-10-01", "unit": "RUB",
      "snippet": "Учебный документ: доход от продажи 1450000 руб.",
      "confirmed": false
    }
  ],
  "documents": [
    { "id": "…", "name": "trade_in.json", "sha256": "…64 hex…",
      "status": "ready", "error": null, "downloadable": false }
  ],
  "runs": [
    {
      "id": "…", "created_at": "…", "rule_version": "0.1.0",
      "enabled_rules": ["sale-income-gap", "obligation-balance"],
      "input_hash": "…64 hex…", "warnings": [],
      "signals": [
        {
          "id": "…", "run_id": "…", "rule": "sale-income-gap",
          "title": "Возможный пропуск дохода от продажи",
          "explanation": "…", "action": "…",
          "evidence": [ /* Fact[] — те же объекты, что в facts */ ],
          "status": "unreviewed",
          "decisions": []
        }
      ]
    }
  ],
  "events": [
    { "id": "…", "message": "Документ загружен: trade_in.json", "created_at": "…", "author": "demo" }
  ]
}
```

Порядок `runs` — `created_at DESC` (клиент берёт `runs[0]` как последний, остальные — «архивные»). В `signals`Evidence-факты отдаются тем же форматом `Fact`; клиент сопоставляет их по `id`.

**`POST /api/cases/{id}/demo?kind=…&clean=…`** — наполнение учебным комплектом. `kind ∈ {"trade_in","apartment"}`, `clean ∈ {"true","false"}` (default false). Создаёт документы/факты по сценариям раздела 8.3. Ответ — валидный JSON (например, обновлённый `CaseDetail`). `404`/`422` при неизвестном `kind`.

**`POST /api/cases/{id}/confirm-facts`** — «Подтвердить все после сверки». Устанавливает `confirmed=true` всем фактам дела (по которым извлечение завершено), пишет событие. Ответ — JSON (`CaseDetail` или `{"confirmed": N}`). Клиент затем запускает анализ.

**`GET /api/cases/{id}/report`** — данные для рабочего документа (клиент скачивает как `${number}.json`). Минимальная схема:

```jsonc
{
  "generated_at": "…", "case": { "number": "PR-2026-0007", "name": "…", "year": 2025, "basis": "candidate" },
  "latest_run": { "id": "…", "created_at": "…", "rule_version": "0.1.0", "input_hash": "…",
    "signals": [ { "rule": "…", "title": "…", "status": "…", "decisions": [ {"status":"…","author":"…","created_at":"…","comment":"…"} ] } ] },
  "limitations": ["Анализ ограничен подтверждёнными полями загруженного синтетического комплекта и выбранными правилами…"]
}
```

Клиент не парсит ответ — формат можно расширять, не ломая UI.

### 5.4 Документы

**`POST /api/cases/{id}/documents`** — multipart, поле `file`. Клиентские ограничения (сервер должен дублировать): расширения `.json .xlsx .pdf .docx`, размер ≤ 5 МБ на файл, несколько файлов подряд.

- `→ 201/200` JSON метаданных документа (`{id, name, sha256, status, error, downloadable}`).
- Валидация: `415` неподдерживаемый тип, `413` превышение размера, `422` пустой/битый файл.
- Поток (раздел 8.4): сохранить файл → sha256 → статус `received` → извлечение → факты + статус `ready`/`failed` (+`error` текстом на русском). Извлечение синхронное допустимо для учебных объёмов; при async — статус `processing` и повторный `GET /cases/{id}`.
- Каждая загрузка — событие «Документ загружен: {name}».

**`GET /api/cases/{id}/documents/{doc_id}`** — скачивание исходного файла (`downloadable=true` только у реально сохранённых файлов; у встроенных демо-фактов — `downloadable=false`, ссылка в UI отсутствует). `404` для недоступных.

### 5.5 Факты

**`PATCH /api/facts/{fact_id}`** — «Уточнить» в таблице извлечённых сведений. Тело:

```json
{ "value": "900000", "date": "2025-10-01", "unit": "RUB", "confirmed": true }
```

- `value` 1–300 симв.; `unit` 1–30; `date` — `YYYY-MM-DD` или `null`; `confirmed` bool.
- `→ 200 Fact` (обновлённый).
- Побочные эффекты: `updated_at` факта → снапшот-Hash меняется → `stale=true` у последнего запуска; событие «Поле уточнено: {label}». Старые запуски не переписываются (их `signals`/`evidence` иммутабельны — evidence хранит слепок значений или ссылку + версионирование, см. 8.5).

### 5.6 Анализ

**`POST /api/cases/{id}/analysis-runs`** — запуск детерминированного анализа. Тело: `{"enabled_rules": ["rule-id-1", …]}` (id из `GET /rules`). Клиент блокирует кнопку при пустом списке; сервер тоже валидирует: `422` при пустом/неизвестном id.

- `→ 201 Run` (новый запуск; старые не трогаем).
- Сервер: строит снапшот входа → `input_hash` → выполняет включённые правила → сохраняет `signals` (status `unreviewed`) + `warnings` → событие «Анализ выполнен: N сигналов» → пересчёт статуса дела.
- Запуск возможен и без `confirm-facts` (клиент не запрещает), но UI-сценарий предполагает подтверждение перед анализом — серверная политика: анализировать все факты дела, `confirmed` входит в снапшот.

**`GET /api/rules`** → `{"rules": [{"id": "…", "title": "…", "description": "…"}]}` — реестр правил для страницы «Правила проверки» (переключатели `role="switch"`). Порядок стабильный. Состав — раздел 8.5; как минимум должны существовать правила, дающие сигналы из e2e: пропуск дохода от продажи и расхождение остатков обязательства.

### 5.7 Сигналы и решения

**`POST /api/signals/{signal_id}/decisions`** — решение специалиста. Тело:

```json
{ "status": "clarification", "comment": "Сопоставлен учебный договор. Нужно уточнение сведений." }
```

- `status ∈ {"clarification","resolved","further_review"}`; `comment` 5–4000 симв. (клиент disabled до ≥5; сервер валидирует `422`).
- `→ 201/200 Decision` `{id, status, comment, created_at, author}`.
- Побочные эффекты: `signal.status = decision.status`; `pending_count` и статус дела пересчитываются; событие «{status}: {rule}. Комментарий: …».
- **Блокировки:** `409` если сигнал принадлежит не последнему запуску («архивный запуск только для просмотра») или дело `stale` («решения по устаревшим сигналам заблокированы») — клиент disabled-кнопки, сервер обязан дублировать проверку.
- `GET` отдельного эндпоинта нет — решения приезжают внутри `CaseDetail.runs[].signals[].decisions[]`.

### 5.8 Сводка эндпоинтов

| # | Метод | Путь | Ответ |
|---|---|---|---|
| 1 | GET | `/api/health` | `{status}` |
| 2 | POST | `/api/auth/login` | `{username}` + cookie |
| 3 | GET | `/api/auth/me` | `{username}` |
| 4 | POST | `/api/auth/logout` | `{}` |
| 5 | GET | `/api/cases` | `CaseSummary[]` |
| 6 | POST | `/api/cases` | `CaseSummary` |
| 7 | GET | `/api/cases/{id}` | `CaseDetail` |
| 8 | POST | `/api/cases/{id}/demo` | `CaseDetail` |
| 9 | POST | `/api/cases/{id}/documents` | doc meta |
| 10 | GET | `/api/cases/{id}/documents/{doc}` | file bytes |
| 11 | POST | `/api/cases/{id}/confirm-facts` | JSON |
| 12 | POST | `/api/cases/{id}/analysis-runs` | `Run` |
| 13 | GET | `/api/cases/{id}/report` | report JSON |
| 14 | PATCH | `/api/facts/{id}` | `Fact` |
| 15 | POST | `/api/signals/{id}/decisions` | `Decision` |
| 16 | GET | `/api/rules` | `{rules[]}` |

Плюс `GET /openapi.json` (вне `/api`).

## 6. Модель данных (PostgreSQL)

```
users ──< sessions
users ──< cases ──< documents ──< facts
cases ──< analysis_runs ──< signals ──< signal_facts >── facts
signals ──< decisions
cases ──< case_events
```

| Таблица | Ключевые поля | Примечания |
|---|---|---|
| `users` | `id uuid pk`, `username text unique`, `password_hash`, `display_name`, `role text default 'specialist'`, `created_at` | demo-юзер сидируется при старте |
| `sessions` | `id uuid pk` (token), `user_id fk`, `created_at`, `expires_at`, `last_seen_at` | TTL + очистка просроченных |
| `cases` | `id uuid pk`, `number text unique`, `owner_id fk`, `name`, `department`, `basis check in ('candidate','expense_review')`, `year int`, `created_at`, `updated_at` | `status`/`stale`/`pending_count` — вычисляемые (8.1–8.2), денормализация опциональна для списка |
| `documents` | `id uuid pk`, `case_id fk`, `filename`, `storage_key`, `sha256 char(64)`, `mime`, `size_bytes`, `status ('received','processing','ready','failed')`, `error text null`, `downloadable bool`, `created_at` | `downloadable=false` у синтетических демо-документов без файла |
| `facts` | `id uuid pk`, `case_id fk`, `document_id fk null`, `field`, `label`, `value text`, `object_id`, `fact_date date null`, `unit`, `snippet`, `confirmed bool default false`, `created_at`, `updated_at` | `document_name` в API собирается из `documents.filename` |
| `analysis_runs` | `id uuid pk`, `case_id fk`, `rule_version`, `enabled_rules jsonb`, `input_hash char(64)`, `warnings jsonb`, `created_at`, `author` | иммутабельны после создания |
| `signals` | `id uuid pk`, `run_id fk`, `case_id fk`, `rule_id`, `title`, `explanation`, `action`, `status default 'unreviewed'`, `sort int`, `created_at` | `status ∈ unreviewed/clarification/resolved/further_review` |
| `signal_facts` | `signal_id fk`, `fact_id fk`, `ordinal int`, `fact_snapshot jsonb`, pk `(signal_id, fact_id)` | связь «сигнал ↔ значения-основания»; `fact_snapshot` — слепок `Fact` на момент запуска (evidence иммутабельно); в API `evidence` = `Fact[]` из слепка |
| `decisions` | `id uuid pk`, `signal_id fk`, `status`, `comment`, `author`, `created_at` | append-only |
| `case_events` | `id uuid pk`, `case_id fk`, `message`, `author`, `created_at` | лента «История действий» |

Индексы: `cases(owner_id, created_at desc)`, `documents(case_id)`, `facts(case_id)`, `analysis_runs(case_id, created_at desc)`, `signals(run_id)`, `signal_facts(fact_id)`, `decisions(signal_id)`, `case_events(case_id, created_at)`, `sessions(expires_at)`.

## 7. Бизнес-логика

### 7.1 Статусы дела и сигналов

- `CaseSummary.status`: `draft` — ни одного запуска анализа; `attention` — последний запуск содержит сигналы, требующие рассмотрения; `completed` — последний запуск есть и `pending_count = 0`.
- `pending_count` = число сигналов **последнего** запуска со `status ≠ 'resolved'` (`unreviewed`, `clarification`, `further_review` — все «ожидающие»). `signals_count` = все сигналы последнего запуска.
- `Signal.status`: `unreviewed` → `clarification | resolved | further_review` по решению специалиста. `further_review` и `clarification` остаются «ожидающими».
- Отображаемые русские ярлыки — забота клиента (`statusLabels`); сервер хранит канонические коды.

### 7.2 Свежесть анализа (`stale`)

- При каждом чтении/мутации сервер пересчитывает `input_hash` текущего снапшота и сравнивает с `input_hash` последнего запуска. Расхождение → `stale=true`, `status` остаётся по последнему запуску.
- Клиент при `stale`: показывает предупреждение, блокирует решения по сигналам старого снимка. Сервер дублирует: `409` на `POST /signals/{id}/decisions` для не-последнего запуска и/или stale-дела.
- `PATCH /facts` и загрузка документов меняют снапшот → stale автоматически.

### 7.3 Демонстрационные комплекты (`POST /cases/{id}/demo`)

Серверные генераторы (сидированные «документы» + факты, `downloadable=false`):

- **`trade_in`** («Соколова Елена · вымышленное лицо» / имя задаётся при создании дела — в сценарии демо клиент шлёт фиксированное имя, сервер может его переопределить или оставить): комплект «Trade-in автомобиля» — продажа авто с доходом, обязательство, справка. Ожидаемые сигналы последнего e2e: «Возможный пропуск дохода от продажи», «Различаются остатки обязательства». Поле «Доход от продажи в справке» редактируется через `PATCH /facts` → после повторного анализа первый сигнал исчезает.
- **`apartment`** («Покупка квартиры»): второй учебный сценарий — объект недвижимости, дата, источник средств.
- **`clean=true`**: «Чистый комплект» — факты без нарушений; анализ → 0 сигналов (проверяется e2e: «Сигналов по выбранным правилам нет»).
- Точные наборы фактов — внутренняя константа сервера; клиент видит только результат через `CaseDetail`.

### 7.4 Конвейер документов

1. `POST /documents`: проверка расширения/размера → запись в `UPLOAD_DIR/cases/{case_id}/{doc_id}_{safe_filename}` → `sha256` → `documents.status='received'`. Дедупликация: тот же `sha256` внутри дела → возвращается существующий документ (идемпотентно).
2. Извлечение (синхронно для учебных объёмов): `received` → `processing` → `ready`/`failed`.
3. Каждый извлечённый факт → `facts` (`confirmed=false`, `document_id`, `document_name=filename`, `snippet`=фрагмент источника). Поле `label` — из словаря `FIELD_LABELS` (ниже) либо из явного `label` в файле; неизвестный `field` → `label = field`.
4. Финал: `status='ready'` (или `failed` + `error` текстом на русском), события «Документ загружен: {name}» и «Документ обработан: {name} — N полей» / «Документ не распознан: {name}».

**Форматы извлечения (учебный шаблон v1):**

- **`.json`** — `{synthetic: true, facts: [{field, value, object_id?, date?, unit?, snippet?, label?}]}`. `synthetic !== true` → `failed`. Обязательны `field` и `value`; `date` — `YYYY-MM-DD`.
- **`.xlsx`** — первый лист, строка 1 — заголовки. Колонки: `field`, `value`, `object_id`, `date`, `unit`, `snippet`, `label` (допустимы русские синонимы: `поле`, `значение`, `объект`, `дата`, `единица`, `фрагмент`, `название`). Пустой лист/нет `field`+`value` → `failed`.
- **`.pdf` / `.docx`** — текст, каждая строка-факт: `field=<имя>; value=<значение>; object_id=<id>; date=<дата>; unit=<ед>; snippet=<фрагмент>` (порядок ключей любой, разделитель `;`, обязательны `field` и `value`). Ноль распознанных фактов → `failed` с «Шаблон документа не распознан».

**`FIELD_LABELS`** (серверный словарь, расширяется вместе с реестром правил):

| `field` | `label` |
|---|---|
| `sale_amount` | Доход от продажи в справке |
| `obligation_balance` | Остаток обязательства |
| `obligation_payment` | Платёж по обязательству |
| `income_declared` | Заявленный доход |
| `expense_amount` | Сумма расхода |
| `purchase_price` | Цена покупки |
| `ownership_years` | Срок владения имуществом |

### 7.5 Движок анализа

- **Реестр правил** — пакет `app/domains/analysis/rules/`: каждый модуль экспортирует `Rule{id, title, description, version?, evaluate(ctx) -> CandidateSignal[]}`. `ctx` — иммутабельный снапшот: реквизиты дела + факты (проиндексированные по `field`/`object_id`, с `confirmed`, `value`, `date`, `unit`). Детерминизм: без I/O, без случайности, без времени.
- **`rule_version`** — semver реестра (например, `0.1.0`), пишется в каждый запуск; сохранённые запуски не пересчитываются.
- **Снапшот и `input_hash`**: каноническая сериализация входа — **все** факты дела (включая `confirmed`, `value`, `date`, `unit`, `object_id`, `field`, `document_id`), отсортированные по `id`, + реквизиты дела (`basis`, `year`, `name`) → SHA-256 hex. Одинаковый вход → одинаковый hash (важно для e2e: повторный анализ без изменений должен давать воспроизводимый результат). Функция `compute_input_hash` живёт в `analysis`-домене и используется также при вычислении `stale` в `cases` (зафиксированный шов — MICROSERVICES.md §5).
- **Сигнал**: `{rule_id, title, explanation, action, evidence_fact_ids[], sort}` → строки `signals` + `signal_facts`. В `signal_facts.fact_snapshot` пишется **слепок `Fact`** (включая `document_name`) на момент запуска — архивные запуски показывают исторические значения даже после `PATCH /facts` (решение открытого вопроса № 9: иммутабельность runs важнее живой ссылки). `fact_id` сохраняется для целостности связей.
- **`warnings`**: предупреждения о качестве данных (например, «есть неподтверждённые поля», «неизвестные field пропущены») — `string[]`, показываются клиентом как `Notice warning`.
- **Покрытие минимум:** правила, воспроизводящие e2e-сценарии — пропуск дохода от продажи (`sale_amount` vs заявленные доходы) и расхождение остатков обязательства; плюс правила из `GET /rules` (тумблер «Сопоставление обязательств»). Точные id правил клиент не раскрывает — см. открытый вопрос № 2.

### 7.6 Решения специалиста и статус

См. 5.7 и 7.1: decision → `signal.status` → пересчёт `pending_count`/`status` дела → событие. Все решения append-only; история хранится в `decisions`.

### 7.7 Журнал событий (`case_events`)

Пишутся сервером при: создании дела, demo-загрузке, загрузке документа, подтверждении фактов, запуске анализа, решении по сигналу, правке факта, формировании отчёта (опционально). Формат `message` — короткая русская строка с деталями (`«Документ загружен: trade_in.json»`), `author` — username. Клиент показывает последние N в «Истории действий» и «Последних действиях».

## 8. Безопасность и ограничения

- **Сессии:** httpOnly + SameSite=Lax + Secure за прокси; TTL; очистка при logout/истечении. Нет CORS — same-origin через nginx/Vite-proxy.
- **Загрузки:** whitelist расширений, лимит 5 МБ (nginx 6m — запас), проверка MIME по содержимому, безопасное имя файла (basename, без path traversal), хранение вне web-root.
- **Валидация:** Pydantic-схемы на входе; доменные ограничения (enum'ы, длины, `synthetic=true`) — `422` со строковым `detail`.
- **БД:** только параметризованные запросы (SQLAlchemy), миграции через Alembic, никаких `eval`/`exec`.
- **Секреты:** только env (`SECRET_KEY`, `DATABASE_URL`, `DEMO_*`, `UPLOAD_DIR`); в репозитории — `.env.example` без значений.
- **Данные:** синтетический контур — `synthetic=false` отклоняется; логирование без ПДн; `Cache-Control: no-store` на все `/api/*` ответы (middleware) — приватные данные не кэшируются.
- **Отказоустойчивость:** ошибки домена — `4xx` с `detail`; непредвиденные — `500 {"detail":"Внутренняя ошибка сервера"}` + лог; клиент показывает общий текст.

## 9. Конфигурация и развёртывание

Env-переменные:

| Переменная | Назначение | Пример |
|---|---|---|
| `DATABASE_URL` | строка подключения | `postgresql+asyncpg://resonance:…@db:5432/resonance` |
| `SECRET_KEY` | подпись/ключи сессий | случайная строка |
| `DEMO_USERNAME` / `DEMO_PASSWORD` | сид demo-аккаунта | `demo` / `resonance-demo-2026` |
| `ALLOW_DEMO_LOGIN` | включать ли demo-логин | `true` (dev) / `false` (prod) |
| `UPLOAD_DIR` | каталог файлов | `/data/uploads` |
| `SESSION_TTL_HOURS` | TTL сессии | `12` |
| `MAX_UPLOAD_MB` | лимит файла | `5` |
| `RULE_VERSION` | переопределение версии правил (опц.) | `0.1.0` |
| `LOG_LEVEL` | логирование | `INFO` |

Dev-запуск: `uvicorn app.main:app --reload --port 8000` из `backend/`; `npm run dev` в `frontend/` (прокси уже настроен). Сборка: `docker build backend/` → сервис `backend:8000`; БД — сервис `db` (postgres:16, volume); фронт — `frontend/` Dockerfile+nginx (уже есть). Корневой `docker-compose.yml` (когда понадобится) — три сервиса `db`, `backend`, `frontend` в одной сети; nginx уже ожидает имя `backend`.

## 10. Этап 2 — домен финансового профиля (`/prototype` → API)

Источники: макет `frontend/src/profile/` (модель, экраны, словари) и документы команды «Резонанс»: «Проект ролей и функций», «Роли и функции + ввод данных», «Интерфейс», «Паспорт проекта». Макет держит состояние в памяти; сервер должен покрыть домен контрактом ниже. Домен — отдельный bounded context `app/domains/profile/` (карта — MICROSERVICES.md).

### 10.1 Роли и доступ

- **`reservist`** — владелец профиля (выпускник «Время героев», включён в федеральный кадровый резерв). Заполняет личный черновик, проходит самопроверку, отправляет на проверку, отвечает на уточнения.
- **`reviewer`** — уполномоченный специалист (кадровое подразделение принимающего органа / Управление). Видит **только назначенные ему** материалы и **только после отправки** резервистом; личный черновик и подсказки самопроверки недоступны — enforced на сервере, не в UI.
- Аутентификация — та же cookie-сессия (`users.role` расширяется: `specialist` (этап 1), `reservist`, `reviewer`); роль определяет доступ к `/api/profile*` и `/api/reviewer*`.
- **Контакты ответственных сотрудников** — справочник (ФИО, зона ответственности, телефон, почта), отдаётся клиенту для подвала платформы («Проект ролей», п. про 59-ФЗ; «Интерфейс» — контакты в сайдбаре).
- Правило источников: отсутствующий ответ источника обозначается **«сведения не получены»**, а не «нет дохода» — состояние хранится отдельно от факта дохода.

### 10.2 Статус-машина профиля (по «Проекту ролей», раздел «Прогресс заполнения»)

| Код | Ярлык | Условие перехода |
|---|---|---|
| `draft` | Личный черновик (прогресс 10/30/50/70/90 %) | редактируется резервистом; прогресс вычисляемый (10.4) |
| `submitted` | Сведения представлены | резервист нажал «Отправить на проверку» → иммутабельная `version N` |
| `accepted` | Принят к рассмотрению | проверяющий принял полный комплект |
| `clarification` | Требуется уточнение | проверяющий вернул материал с вопросом → резервист отвечает, готовит `version N+1` |
| `resubmitted` | Сведения представлены повторно | отправка исправленной версии (старые версии не переписываются) |
| `completed` | Рассмотрение завершено | проверяющий внёс подтверждающее основание + документ |
| `removed` | Снят с рассмотрения с обоснованием | проверяющий внёс обоснование снятия |

Переходы валидируются сервером: submit — только из `draft`/`clarification`; решения проверяющего — только из `submitted`/`accepted`/`resubmitted`; комментарий обязателен при `clarification`/`removed` и при любом решении по несоответствию (статус «включён» не означает признания нарушения).

### 10.3 Модель данных (добавляется к §6)

```
users(role: reservist|reviewer)
profiles ──< service_periods ──< payment_blocks ──< payment_records ──< profile_documents
profiles ──< kinship_relatives            profiles ──< activities
profiles ──< profile_versions (immutable snapshot JSONB + progress + created_at)
profiles ──< profile_signals ──< profile_signal_decisions
profiles ──< profile_messages (reviewer ↔ reservist)
profiles ──< profile_reviews (итоговый статус + основание + документ)
profiles ──< profile_audit (actor, action, scope private|submitted, target, created_at)
reviewer_assignments (reviewer_id, profile_id, assigned_by, created_at) — назначение материалов
```

Ключевые поля `profiles`: `owner_id`, `person` (ФИО, дата рождения, **телефон, почта** — показываются проверяющему, «Интерфейс» скрин 4), `program` (поток, год обучения, регион, региональная программа + её год — напр. «Герои Липецкой земли», 2025), `reserve_act` (номер и дата НПА о включении в резерв), `work_status` (`serving|outside|reserve|retired`), `appointment_authority` («ОИВ субъекта РФ» / «Федеральный орган исполнительной власти» / иное, необязательное), `status` (10.2), `progress` (вычисляемый), `photo_document_id` (визуальное удобство, без распознавания лиц).

`kinship_relatives` — минимальный объём: `full_name`, `degree` (супруг/ребёнок/родитель/иная), `participant_status` (`participating|participated|deceased|missing`); медицинские и служебные подробности родственника **не** собираются. Флаг `received_relative_payments` + записи в `payment_records` категории «выплаты за родственника».

### 10.4 Прогресс и комплектность (правила «Проекта ролей»)

Прогресс — вычисляемый сервером процент по вехам (нужен `GET /api/profile/completeness`):

| % | Веха |
|---|---|
| 10 | подтверждены личность (ФИО, дата рождения, контакты), место работы, данные потока |
| 30 | загружен диплом о переподготовке + реквизиты акта о включении в резерв |
| 50 | заполнены периоды службы и блок родства (ответ «нет» тоже закрывает веху) |
| 70 | по каждой из 10 категорий выплат дан ответ «получал / не получал / планируется» |
| 90 | по всем «да/планируется» заведены записи по схеме и заполнен блок деятельности |

`submit` отклоняется `422` с перечнем незакрытых вех, если прогресс < 90 % или нарушена обязательность документов (10.5).

### 10.5 Категории выплат и обязательность (по «Роли и функции + ввод данных»)

`payment_blocks`: `category` (enum 10 значений), `answer` (`yes|no|planned` — `planned` только у жилищных), записи `payment_records` по схеме **получатель → вид выплаты → основание → период → документ** (`recipient_kind` candidate|family_member|relative_participant, `recipient_ref`, `kind`, `basis`, `period_from/to`, `document_id`).

| # | Категория (`category`) | Поля записи и обязательность документа |
|---|---|---|
| 1 | `monetary_allowance` — денежное довольствие | да/нет; «да» → приказ о назначении (файл обязателен); периоды + плательщик |
| 2 | `allowances` — надбавки и доп. выплаты | да/нет; приказ + доп. файлы (основание, напр. степень) — файл обязателен |
| 3 | `one_time` — единовременные выплаты | наименование; вид события + дата; категория получателя; НПА + редакция на применимую дату; дата фактического перечисления; документ **при наличии** |
| 4 | `support` — федеральная/региональная/муниципальная поддержка | `level` (federal|regional|municipal); наименование меры; код меры (если есть); дата выплаты; документ **обязателен** |
| 5 | `insurance` — страховые выплаты и компенсации | да/нет → файлы (решение страховщика/органа, справка); вложенный подблок «выплата за родственника — участника СВО» (да/нет → файлы) |
| 6 | `pensions` — пенсии и социальные выплаты | да/нет; документ **не требуется** (сведения у соцфондов) |
| 7 | `family_payments` — выплаты членам семьи за резервиста | да/нет → записи: связь с кандидатом, ФИО + год рождения получателя, документ (решение органа/НПА); мультизаписи |
| 8 | `material_aid` — матпомощь организаций и фондов | да/нет → назначение; форма `monetary|in_kind`; файл (решение/договор/письмо) |
| 9 | `housing` — жилищные меры | да/**планируется**/нет; «планируется» → предполагаемый год + документ-основание (обязателен); «да» → вид (`subsidy|compensation|property|credit`), основание (акт/договор), дата решения, дата приобретения, файл |
| 10 | `non_monetary` — неденежные меры | да/нет → файл; отдельно от дохода (прототип не блокирует избыточный учёт — оценка у проверяющего) |

Общие правила валидации: запрет банковских выписок как типа документа (комментарий в `profile_documents.kind`); незаполненная обязательная категория/запись блокирует submit (`422` со списком); поля, требующие файл без файла, помечаются в ответе `completeness.missing`.

Блок `activities` (экспертная/преподавательская): вопрос да/нет → записи {`organization`, `kind` (teaching|expertise|consulting|commission|other), `engagement` (employment|fixed_term|part_time|civil|voluntary), `period_from/to`, `basis_document` (договор/приказ)}.

### 10.6 Детерминированные проверки профиля (несоответствия)

Серверный движок правил профиля (переиспользует каркас `analysis/rules`, `rule_version` профиля): запуск при submit (и пересчёт при resubmitted) над снапшотом версии. Клиент показывает как «несоответствия» («Интерфейс» скрин 4/7); статусы рассмотрения: `unreviewed → reviewed|clarification|dismissed` («Рассмотрено / Запрошено уточнение / Исключено с обоснованием» — все с обязательным комментарием).

| Код | Проверка (по «Проекту ролей», «Содержательное сопоставление») |
|---|---|
| `ПЕ-01` | Согласованность периодов: период/дата выплаты вне периодов службы профиля |
| `РО-01` | Получатель: выплата «за родственника» записана как личная (основание упоминает родственника/родство, а `recipient_kind=candidate`) — есть в макете |
| `РО-02` | Родство↔выплаты: указано родство + `received_relative_payments`, но блок выплат за родственника пуст (или наоборот — выплаты за родственника при родстве «нет») |
| `ОС-01` | Соответствие вида и основания: основание не подходит к заявленной категории (эвристика по `basis`/`kind`) |
| `ДЕ-01` | Деятельность↔служба: период `activities` пересекается с периодом военной службы → требуется проверка уведомления — есть в макете |
| `ДУ-01` | Повторный учёт: совпадают получатель + сумма + назначение/основание в разных категориях — есть в макете |
| `ЖМ-01` | Жилищные меры: смешаны денежная выплата/субсидия/кредит/предоставление (`housing.kind` противоречит основанию) |
| `КП-01` | Комплектность: запись категории без обязательного документа (support/housing/приказы) |

### 10.7 Эндпоинты этапа 2 (реализовано — итерация 8)

Префикс `/api`, те же соглашения §3 (JSON везде, `detail`-ошибки, no-store). Резервист — только свой профиль (`require_reservist`); проверяющий — `reviewer|specialist` (`require_reviewer`), видит только submitted-контур. Промежуточные решения (`accept`, `clarification`, `complete`, `remove`) объединены в один эндпоинт `POST /reviewer/profiles/{id}/decision` с полем `action` — единая точка статус-машины и аудита.

| Метод | Путь | Назначение |
|---|---|---|
| GET/PUT | `/api/profile` | черновик владельца (автосоздание при первом GET; PUT — полная замена, `409` вне draft/clarification) |
| GET | `/api/profile/completeness` | прогресс, вехи, `missing[]`, `can_submit` |
| POST | `/api/profile/submit` | `422` при неполноте; иначе → `profile_versions N` + проверки + auto-assign, статус `submitted`/`resubmitted` |
| GET | `/api/profile/versions`, `…/versions/{n}` | свои версии и слепки (резервист) |
| GET | `/api/profile/signals` | несоответствия по своим опубликованным версиям |
| POST/DELETE | `/api/profile/documents`, `…/documents/{id}` | multipart-вложения (`kind`: diploma/reserve_act/order/contract/act/letter/other), дедуп по sha256 |
| GET/POST | `/api/profile/messages` | переписка; POST — ответ резервиста (`409` до первой публикации) |
| GET | `/api/profile/audit` | журнал своего профиля (оба scope) |
| GET | `/api/reference/contacts` | ответственные сотрудники (справочник для обеих ролей) |
| GET | `/api/reference/rules` | реестр детерминированных проверок профиля |
| GET | `/api/reviewer/queue` | очередь опубликованных профилей; фильтр `?status=` |
| GET | `/api/reviewer/profiles/{id}` | последняя версия + несоответствия + переписка + решения (404 для черновика) |
| POST | `/api/reviewer/profiles/{id}/decision` | `action: accept|clarification|complete|remove`; комментарий ≥5; `remove` требует `basis`; `409` при completed/removed |
| POST | `/api/reviewer/signals/{id}/decision` | решение по несоответствию (`reviewed|clarification|dismissed` + комментарий ≥5) |
| GET/POST | `/api/reviewer/profiles/{id}/messages` | переписка по материалу |
| GET | `/api/reviewer/profiles/{id}/audit` | журнал submitted-scope |
| GET | `/api/reviewer/profiles/{id}/export` | выгрузка JSON результата (версия + сигналы + решения + ограничения) |

Аудит `profile_audit` пишется при: входе, просмотре submitted-версии, загрузке/выгрузке, изменении статуса, решении по несоответствию, сообщении. Резервист видит `private`-scope своего профиля + публичные события submitted; проверяющий — только `submitted`-scope.

### 10.8 Интерфейсные требования к серверу (по «Интерфейс»)

- Карточка для проверяющего включает **контакты резервиста** (телефон, почта) — поля обязательны в `person`.
- Программа отдаётся конкретным наименованием по региону (`regional_program`, `regional_program_year`); «Федеральный резерв» в UI не дублируется — это контекст по умолчанию.
- Самопроверка («Проверьте полноту и достоверность предоставленных сведений») — серверный `completeness`; повторная проверка — повторный GET (кнопка-«обновить» на клиенте).
- Финансовая сводка для проверяющего: агрегат «Сведения о доходах» — общая сумма денежных поступлений + разбивка по категориям (сервер считает по `payment_records` с денежной формой; `non_monetary`/`in_kind` в сумму не входят).
- Терминология API — коды сущностей; русские ярлыки («несоответствия», «Поступило на проверку», «N данных на рассмотрении») — забота клиента.

### 10.9 Границы этапа 2

- Только синтетические данные (`synthetic=true` на создаваемых объектах, как в этапе 1).
- Решения — за уполномоченным специалистом; несоответствие ≠ нарушение; платформа не дублирует «Справки БК»/«Посейдон» (банковские выписки не принимаются).
- Фото профиля — файл, без распознавания лиц.
- Назначение материалов проверяющим — таблица `reviewer_assignments`; в прототипе допустимо сидирование назначения demo-reviewer на все submitted-профили (упрощение, зафиксировать в README).

## 11. Открытые вопросы

1. ~~**`pending_count`/`status` дела**~~ — **решено (v1.1):** `pending_count` = сигналы последнего запуска со `status ≠ 'resolved'`; `status`: `draft` (нет runs) / `attention` (pending>0) / `completed` (pending=0).
2. **Реестр правил:** точные `id`/`title`/`description` для `GET /rules` и `signal.rule` — клиент показывает их, но не раскрывает полный список. Нужен канонический список (e2e требует минимум два правила).
3. ~~**Снапшот анализа**~~ — **решено (v1.1):** все факты дела + реквизиты; `confirmed` — часть снапшота.
4. ~~**Формат `CaseDetail.events.message`**~~ — **решено (v1.1):** обязателен формат «Короткое: детали».
5. ~~**Нумерация `number`**~~ — **решено (v1.1):** `PR-<year>-<seq:04d>`, seq внутри года.
6. **Мультипользовательность:** `owner_id`-изоляция реализована; UI не различает пользователей — один demo-аккаунт для этапа 1.
7. ~~**Извлечение PDF/DOCX**~~ — **решено (v1.1):** маркерные строки `key=value; …` (см. §7.4); XLSX — заголовки EN/RU.
8. **Async-конвейер:** достаточно ли синхронного извлечения (учебные файлы малы) или нужен worker/очередь?
9. ~~**`evidence` в сигналах**~~ — **решено (v1.1):** слепок `Fact` в `signal_facts.fact_snapshot`.
10. **Отчёт:** клиент не парсит `/report` — допустима любая JSON-схема; для печатного PDF клиент использует `window.print()` на своём рендере.

## 12. Критерии приёмки (минимум)

- `flow.spec.ts` проходит против локального backend: логин demo → создание дела → demo-комплект trade_in → подтверждение → анализ (2 сигнала) → решение → правка факта → stale → повторный анализ (1 сигнал) → отключение правила → 0 сигналов → отчёт `PR-*.json`.
- Все 16 эндпоинтов + `/api/health` + `/openapi.json` описаны в Swagger и работают.
- Ни один ответ не пустой: везде валидный JSON.
- `401`-семантика, блокировки stale/архивных решений (`409`), валидация `comment ≥ 5`, `synthetic=true`.
- Миграции Alembic с нуля до схемы раздела 6; сид demo-аккаунта и (опционально) демо-дела.
