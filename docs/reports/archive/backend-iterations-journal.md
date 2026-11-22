# Журнал итераций backend · архив

Исторический журнал разработки backend до API-интеграции профиля, перенесён из `backend/README.md` 22.11.2026. Записи отражают состояние на дату каждой итерации, а не текущий контракт.

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

### Итерация 4 — микросервисная декомпозиция: bounded contexts (17.11.2026)

- `app/` перестроен из плоской структуры в доменные модули: `core/` (shared kernel: config, db, deps, base), `platform/` (health), `domains/{identity,cases,documents,analysis,reporting}` — каждый с `api.py`/`schemas.py`/`services.py`/`models.py` по единому шаблону.
- ORM-модели распределены по доменам-владельцам: `identity` → users/sessions; `cases` → cases/case_events; `documents` → documents/facts; `analysis` → analysis_runs/signals/signal_facts/decisions; enum'ы переехали в `models.py` своих доменов. Старые `app/models`, `app/api`, `app/schemas`, `app/services`, `app/rules`, `app/repositories` удалены.
- `core/deps.py` — точка внедрения зависимостей (`get_db`; позже `get_current_user` от identity-сервиса). `main.py` — composition root: монтирует platform + доменные роутеры под `/api`.
- `MICROSERVICES.md`: карта из 6 сервисов с data ownership, shared kernel, синхронные/асинхронные контракты (outbox → брокер), порядок выделения Phase 0–4, чек-лист для новых эндпоинтов.
- `SPEC.md`: дерево структуры обновлено под `domains/`; `app/rules/` → `app/domains/analysis/rules/`; `/api` зафиксирован как v1.
- Проверено: `ruff` чист, `pytest` 3/3, `create_app()` — роуты `/api/health` + `/openapi.json` на месте.

### Итерация 4.5 — секреты (17.11.2026)

- `.env.example` очищен от кредов: `DATABASE_URL` без пароля, `SECRET_KEY` пустой с подсказкой, `DEMO_PASSWORD` убран.
- `app/core/config.py`: убраны дефолтные `postgresql+asyncpg://resonance:resonance@…`, `secret_key="dev-secret-change-me"` — реальные значения только из env/`.env`. `demo_password` оставлен (учебный логин, виден в UI клиента).

### Итерация 5 — auth: identity-домен (17.11.2026)

- `domains/identity/services.py`: argon2id (`argon2-cffi`, зависимость в `pyproject`); `authenticate` с фиктивным хэшом против user-enumeration; серверные сессии `secrets.token_urlsafe(32)`, TTL из `SESSION_TTL_HOURS`, ленивое продление при активности (не чаще 5 мин, явный commit — `get_db` не коммитит); идемпотентный `seed_demo_user` из env.
- `domains/identity/deps.py`: `get_current_user` — публичный auth-контракт домена (точка подмены при выделении в сервис); токен сессии кладётся в `request.state.session_token`.
- `domains/identity/api.py`: `POST /auth/login` (cookie `session`: HttpOnly, SameSite=Lax, Path=/, Secure вне development), `GET /auth/me`, `POST /auth/logout` → `{}`. Все ответы JSON.
- `main.py`: lifespan с best-effort сидом demo-аккаунта (недоступная БД не роняет health); доменные роутеры cases/documents/analysis/reporting подключены с `dependencies=[Depends(get_current_user)]` — защита на уровне роутера.
- `tests/conftest.py`: общие фикстуры `db_session` (SQLite memory) и `client` (AsyncClient + override `get_db`); `test_models.py` переведён на общую фикстуру. `tests/test_auth.py`: 6 тестов — public health, 401 без сессии, неверный пароль/неизвестный юзер, полный flow login→me→logout, протухшая сессия.
- `pyproject.toml`: `argon2-cffi>=23.1,<26`; ruff `extend-immutable-calls` для `fastapi.Depends` и др. (B008).
- Проверено: `ruff` чист, `pytest` 9/9, uvicorn + curl на живом PostgreSQL — login/me/logout E2E OK.

### Итерация 6 — SPEC v1.1 + cases-домен (17.11.2026)

**SPEC.md → v1.1** (закрыты вопросы §11): evidence — слепок `Fact` в `signal_facts.fact_snapshot`; `pending_count` = сигналы последнего run со status ≠ resolved; `number` = `PR-<year>-<seq:04d>` (seq внутри года); формат событий «Короткое: детали»; маппинг имён API↔БД; `Cache-Control: no-store` обязателен; гигиена OpenAPI (summary/description/responses).

- `signal_facts.fact_snapshot` (JSONB) — модель + миграция `50540a258aed` поверх `887add606ce1` (initial перегенерирован под старый revision id — цепочка и свежая БД корректны).
- `analysis/services.py`: `compute_input_hash` — канонический SHA-256 снапшота (case meta + все факты по `id`); единственная точка формата, используется и для `stale`.
- `documents/`: `FactOut`/`DocumentOut` DTO + `serialize_fact`/`serialize_document` — единый маппинг ORM→API (он же пишет `fact_snapshot`).
- `analysis/schemas.py`: `RunOut`/`SignalOut`/`DecisionOut` + входные `AnalysisRunIn`/`DecisionIn`.
- `cases/`: `CaseSummaryOut`/`CaseDetailOut`/`CaseCreateIn`/`EventOut`; сервисы — `list_cases` (метрики последнего run + stale пакетом), `create_case` (нумерация, событие), `get_case_detail` (evidence из слепка, fallback на живой факт); `record_event` — общая точка аудита.
- `cases/api.py`: `GET /cases`, `POST /cases` (201), `GET /cases/{id}` (404 чужое/нет) — owner-изоляция, `synthetic=true` валидация.
- `core/schemas.py`: `ErrorOut` для документированных 4xx в Swagger; summary/description/responses на всех эндпоинтах.
- `main.py`: middleware `no-store` на `/api/*`.
- `tests/conftest.py`: общие `demo_user`/`auth_client`; `test_cases.py` — 9 тестов (auth-гард, CRUD, нумерация, валидация 422, дефолт department, detail+события, 404, owner-изоляция); `test_auth.py` на общих фикстурах.
- Проверено: `ruff` чист, `pytest` **18/18**, OpenAPI — теги/summary/enum'ы/коды ответов; uvicorn + живой PostgreSQL: login → create `PR-2025-0001` → list → detail → `no-store` — E2E OK.

### Итерация 7 — движок анализа, demo-комплекты, отчёт: контракт этапа 1 закрыт (17.11.2026)

- `app/domains/analysis/rules/` — реестр из 3 детерминированных правил (`Rule{id,title,description,evaluate(ctx)}`, чистые функции над снапшотом): `sale-income-gap` («Возможный пропуск дохода от продажи»), `obligation-balance` («Сопоставление обязательств» → «Различаются остатки обязательства»), `expense-coverage` («Расход не покрыт заявленными поступлениями»). Числа — `Decimal`, порядок фактов — по `id`.
- `analysis/api.py`: `GET /rules` (стабильный порядок), `POST /cases/{id}/analysis-runs` (201, `input_hash` SHA-256 снапшота, `warnings` по неподтверждённым полям, сигналы с `signal_facts.fact_snapshot`-слепками, 422 на пустой/неизвестный набор правил), `POST /signals/{id}/decisions` (201; `409` — архивный запуск или stale-дело; решение меняет `signal.status`, пересчёт pending происходит при чтении).
- `documents/demo.py`: комплекты `trade_in` (2 «документа», 5 фактов → 2 сигнала), `apartment` (расход vs источники), `clean=true` — без расхождений; `POST /cases/{id}/demo` идемпотентен по sha256 документа; `downloadable=false`.
- `reporting/`: `GET /cases/{id}/report` — `{generated_at, case, latest_run, signals_total, pending_count, limitations[]}`; клиент скачивает как `PR-*.json`.
- `FIELD_LABELS` дополнен `obligation_initial`; `AnalysisRun.created_at` — явный UTC-timestamp (микросекунды) для стабильного порядка runs на SQLite.
- `tests/test_analysis.py` — 10 контракт-тестов: реестр, demo-идемпотентность/404, сигналы+evidence, детерминизм hash, валидация 422, warnings, решения (422/<5, 201, 404), блокировки 409 stale/архив, иммутабельность слепка evidence, структура отчёта.
- **Проверено:** `ruff` чист, `pytest` **37/37**; E2E по `flow.spec.ts` вручную через curl на uvicorn и через nginx (`:8080`, docker-стек пересобран): login → дело → demo → confirm → анализ (2 сигнала) → решение → PATCH → stale → переанализ (1 сигнал) → отключение правила (0) → report; `/openapi.json` — все 16 эндпоинтов + health.

**Контракт этапа 1 реализован полностью.** Далее — этап 2 (SPEC §10): домен финансового профиля (`app/domains/profile/`), начиная с моделей + черновика резервиста.

### Итерация 8 — домен `profile`: двухролевый контур финансового профиля (17.11.2026)

- `app/domains/profile/` — новый bounded context (SPEC §10): `models.py` (12 таблиц), `schemas.py`, `services.py`, `rules.py`, `api.py`; миграция `e14c17090890`.
- **Модель**: `profiles` (анкета, поток, акт, статус-машина `draft → submitted → accepted/clarification → resubmitted → completed/removed`), `service_periods`, `kinship_relatives`, `payment_blocks` + `payment_records` (10 категорий, UNIQUE по категории, `extra` JSONB для редких реквизитов), `activities`, `profile_documents`, `profile_versions` (неизменный JSONB-слепок агрегата), `profile_signals` + `profile_signal_decisions` (append-only), `profile_messages`, `profile_reviews`, `profile_audit` (scope `private`/`submitted`), `reviewer_assignments`, `reference_contacts`.
- **Резервист** (`role=reservist`): `GET/PUT /api/profile` (полная замена черновика, `409` вне draft/clarification), `GET /profile/completeness` (вехи 10/30/50/70/90 + `missing[]` + `can_submit`), `POST/DELETE /profile/documents` (kind: diploma/reserve_act/order/contract/act/letter/other; лимиты §8; дедуп sha256), `POST /profile/submit` (→ слепок версии + проверки + auto-assign), `GET /profile/versions[/{n}]`, `GET /profile/signals`, `GET/POST /profile/messages`, `GET /profile/audit`.
- **Проверяющий** (`role=reviewer|specialist`): `GET /reviewer/queue?status=` (только опубликованные — черновики невидимы), `GET /reviewer/profiles/{id}` (последняя версия + сигналы + переписка + решения), `POST /reviewer/profiles/{id}/decision` (`action: accept|clarification|complete|remove`; `remove` требует `basis`; `409` после финала), `POST /reviewer/signals/{id}/decision` (reviewed|clarification|dismissed), `GET/POST …/messages`, `GET …/audit` (только submitted-scope), `GET …/export` (JSON результата с ограничениями).
- **Детерминированные проверки** `rules.py` — 6 правил над снапшотом версии: `period-order`, `relative-without-kinship`, `kinship-payments-missing`, `housing-kind-required`, `document-basis-required`, `activity-outside-service`; реестр — `GET /api/reference/rules`.
- **identity**: сид demo-аккаунтов `reservist` и `reviewer` (тот же учебный пароль, `ALLOW_DEMO_LOGIN`); auto-assign профиля на первого проверяющего при публикации.
- `tests/test_profile.py` — 18 контракт-тестов: ролевые границы (401/403), вехи прогресса, полная замена черновика, публикация + слепки версий, невидимость черновика, жизненный цикл несоответствий и решений, переписка, аудит по scope, дедуп документов, экспорт.
- **Проверено:** `ruff` чист, `pytest` **55/55**; живой E2E через curl: reservist → черновик 90% → submit v1 → сигнал `kinship-payments-missing` → clarification → вопрос резервисту → правка → resubmit v2 → complete → аудит; docker-стек пересобран, миграция применена, контур работает через nginx `:8080`; `/openapi.json` — 33 пути, теги `profile`/`reviewer`/`reference`, 64 схемы.

### Итерация 9 — клиент профиля: API-backed контуры резервиста и проверяющего (17.11.2026)

- `frontend/src/app/profile.tsx` — рабочее пространство этапа 2 в основном приложении (`/`): после входа пользователь с `role=reservist|reviewer` получает свой контур вместо делопроизводства (`specialist` — прежний UI).
- **Резервист**: черновик-форма (анкета, поток, акт, периоды службы, родство СВО, 10 категорий выплат с записями, доп. деятельность), панель вех 10–90% с `missing[]`, загрузка/удаление документов по виду, «Представить сведения», версии, несоответствия, переписка, справочник операторов. Редактирование заблокировано вне `draft`/`clarification`.
- **Проверяющий**: очередь с фильтром по статусу и счётчиком несоответствий; карточка — слепок версии, несоответствия с решениями (комментарий ≥5), решение по профилю (accept/clarification/complete/remove + `basis`), переписка, выгрузка JSON.
- `UserOut` расширен: `display_name`, `role` (login/me) — клиент выбирает контур по роли; `model.ts`/`App.tsx`/`views.tsx` обновлены.
- **Найден и исправлен UX-баг**: загрузка документа/ответ в переписке перезагружала черновик и затирала несохранённые правки — теперь точечное обновление коллекций.
- `/prototype` (`src/profile/`) оставлен дизайн-макетом — его покрывают 8 тестов `profile.spec.ts`.
- **Тесты**: `tests/flow.spec.ts` +1 e2e — двухролевой сценарий через nginx: reservist → черновик 90% → submit → reviewer очередь → несоответствие → clarification → вопрос резервисту. Playwright **5/5** + **8/8** prototype, `tsc` чист.
- **Инфра**: `HTTP_PORT=8080` зафиксирован в `.env`; пароль Postgres приведён в соответствие с `.env` после пересоздания db.

**Итого после этапа 2:** backend 55 тестов + frontend 13 e2e; Swagger — 34 пути (`/api/profile*`, `/api/reviewer*`, `/api/reference/*` с русскими summary).

### Итерация 7 — SPEC v1.2 + documents-домен (17.11.2026)

**SPEC.md → v1.2**: контракты извлечения зафиксированы — JSON `{synthetic:true, facts:[…]}`, XLSX с RU-заголовками, PDF/DOCX маркерные строки `field=x; value=y; …`; неподдержанный шаблон → `status=failed` + `error='Шаблон документа не распознан'`; `FIELD_LABELS` — серверный словарь подписей; дедупликация по sha256 внутри дела; заголовок OpenAPI → `Резонанс · синтетический прототип` (e2e `flow.spec.ts` проверяет title).

- `documents/pipeline.py` — парсеры 4 форматов без сети: `_parse_json` (обязателен `synthetic:true` + массив `facts`), `_parse_xlsx` (openpyxl, канонические+русские заголовки), `_parse_pdf` (pypdf, текст → маркерные строки), `_parse_docx` (python-docx, абзацы → маркеры); `_norm_fact` — единая нормализация (field/value обязательны, date ISO, лимиты длин); `fact_label` — словарь `FIELD_LABELS` → field.
- `documents/schemas.py`: `DocumentOut`/`FactOut`/`FactPatchIn` (value/date/unit/confirmed, все опциональны, min_length/max_length).
- `documents/services.py`: `upload_document` → `(doc, created)` — валидация расширения (415), пустоты (422), размера (413), sha256-дедуп (200 вместо 201); `_extract` — processing → ready/failed + факты (`confirmed=false`, `document_name`); `patch_fact` — owner-check через join case, событие «Поле уточнено»; `confirm_case_facts` — массовое подтверждение + событие; `get_document_file` — скачивание только `downloadable` с файлом на диске.
- Хранение: `UPLOAD_DIR/cases/{case_id}/{doc_id}_{safe_filename}`; `_safe_filename` — basename + очистка опасных символов.
- `cases/events.py` — `record_event` вынесен из services (разрыв цикла documents↔cases services; `cases.services` реэкспортирует).
- `cases/services.py`: `get_owned_case` — seam owner-check для других доменов.
- `documents/api.py` — 4 эндпоинта с тегом `documents`, русскими summary/description, документированными 404/413/415/422: `POST /cases/{id}/documents` (multipart `file`, 201/200-дедуп), `GET /cases/{id}/documents/{doc}` (FileResponse), `PATCH /facts/{id}`, `POST /cases/{id}/confirm-facts` → `{"confirmed": N}`.
- `main.py`: title → `Резонанс · синтетический прототип`.
- `pyproject.toml`: `openpyxl`, `pypdf`, `python-docx`, `python-multipart`.
- `tests/test_documents.py` — 9 тестов: JSON-извлечение + FIELD_LABELS, sha256-дедуп, 415/422/failed-пайплайн, non-synthetic → failed, 404 чужого дела, PATCH+confirm-facts+события, валидация PATCH/404, скачивание, XLSX RU-заголовки, валидный PDF (генерируется с xref в тесте) и DOCX маркеры.
- Проверено: `ruff` чист, `pytest` **27/27**, OpenAPI — 10 путей, все новые эндпоинты с тегом `documents`; uvicorn + живой PostgreSQL E2E: login → case `PR-2025-0012` → upload `up.json` → `ready`+2 факта → PATCH → `confirm-facts` → download 200 → лента событий полная.

**Далее:** `POST /cases/{id}/demo` (trade_in/apartment/clean) → analysis (rules + runs + signals) → decisions → report.

### Итерация 9 — SPEC §10.8: финансовая сводка проверяющего (17.11.2026)

- `profile/services.py`: `income_summary(snapshot)` — агрегат «Сведения о доходах» над слепком `ProfileVersion.snapshot` (иммутабелен, совпадает с показанной версией): суммируются только записи `form="monetary"`; категория `non_monetary` и форма `in_kind` исключены; `Decimal`-арифметика, итог `{currency:"RUB", total, records, by_category[]}`.
- `profile/schemas.py`: `IncomeSummaryOut` + `IncomeCategoryTotal`; поле `income_summary` добавлено в `ReviewerProfileOut` — сводка видна только проверяющему в карточке профиля.
- `profile/api.py`: `GET /reviewer/profiles/{id}` заполняет `income_summary` из `version.snapshot`.
- `tests/test_profile.py`: `test_reviewer_income_summary` — черновик с monetary/in_kind/non_monetary записями → submit → проверка итога `200000.00`, `records=3`, разбивка по категориям; in_kind (999) и non_monetary (777) не входят.
- Проверено: `ruff` чист, `pytest` **58/58**; `/openapi.json` — 35 путей, все 19 эндпоинтов §10.7 (`profile`/`reviewer`/`reference`), `IncomeSummaryOut` в схемах.

**Контракт этапа 2 (SPEC §10) реализован полностью.** Открытый фронт работ — итерация 10: подключение `frontend/src/profile` к API (сейчас макет в памяти).

### Итерация 11 — завершение функционального контура этапа 2 (17.11.2026)

- Синхронизированы исправления из более новой копии: `GET /api/auth/session`, `rub()` для пустых `sum()`, `from_attributes` для вложенных DTO, структурный diff версий (`profile/diff.py`), эндпоинты `GET /profile/versions/{n}/diff/{m}`, `GET /reviewer/profiles/{id}?version=`, `GET /reviewer/profiles/{id}/versions`, `GET /reviewer/profiles/{id}/diff`.
- Клиент: сравнение версий у резервиста и проверяющего, переключение версии, выделенный блок «Причина уточнения», печатная форма «Сведения о доходах» (`window.print()`), локальные шрифты Lato без внешних запросов.
- Исправлена проблема портативности: `now()` заменён на `CURRENT_TIMESTAMP` в моделях и миграциях — локальный запуск на SQLite больше не падает при сиде демо-аккаунтов.
- Исправлена гонка параллельных boot-запросов: ленивое создание профиля сериализуется локальной блокировкой и фиксируется в БД; добавлен регрессионный тест.
- CSP дополнен `font-src 'self' data:` в nginx и preview; добавлен локальный fallback `/docs → /docs/` для `vite preview`.
- Проверено: `pytest` **61/61**, `ruff` чист, `tsc` чист, `vite build` OK, Playwright **8/8** макета и **5/5** интеграционного сценария.

### Итерация 10 — frontend `ProfileApp` + фикс сериализации reviewer-карточки (17.11.2026)

**Контекст:** `src/app/profile.tsx` (`ProfileApp`) уже был подключён к API параллельной работой — App.tsx роутит `reservist`/`reviewer` в него после логина; `/prototype` остаётся in-memory макетом (его держат `tests/profile.spec.ts`).

- **Багфикс backend:** `GET /api/reviewer/profiles/{id}` отдавал **500** на профилях с перепиской/решениями — api.py конструировал `ReviewerProfileOut` напрямую из ORM-объектов `ProfileMessage`/`ProfileReview`, а вложенные `MessageOut`/`ReviewOut` не имели `from_attributes` (тесты проходили, т.к. списки были пусты). Fix: `model_config = ConfigDict(from_attributes=True)` в `MessageOut` и `ReviewOut`. Проверено на живом API: 200, messages/reviews/income_summary на месте.
- **Frontend `src/app/profile.tsx`:**
  - `ReviewerView` — панель «Сведения о доходах» (SPEC §10.8): итог + разбивка по категориям из `income_summary`; панель «Журнал рассмотрения» (`GET …/audit`, submitted-scope).
  - `ReservistView` — поле «Форма» (monetary/in_kind) в редакторе записей выплат (без него `income_summary` из UI всегда 0); панель «Журнал действий» (`GET /profile/audit`).
  - Типы: `IncomeSummary`, `AuditEvent`, `income_summary` в `ReviewerProfile`.
- Проверено: `tsc --noEmit` чист, `vite build` OK; backend `ruff` чист, `pytest` **58/58**; живой E2E: reviewer login → queue → карточка completed-профиля → 200 + `income_summary`. Браузерный e2e (Playwright + vite :5173 → backend :8000): reservist — workspace/полнота/версии/контакты/аудит/документы; reviewer — очередь → карточка → «Сведения о доходах»/слепок/решения/аудит/export — 15/15 проверок.
