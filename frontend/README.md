# Резонанс · frontend

Клиентская часть прототипа «Резонанс». Единый интерфейс финансового профиля на `/` для всех ролей. `reservist` получает собственный кабинет, `reviewer` и `demo` открывают назначенные представленные материалы. Совместимая ссылка `/prototype` открывает ту же сборку.

**Стек.** React 19, TypeScript 5.8, Vite 6, Playwright. Node 22+ и npm 10+, версия Node зафиксирована в `.nvmrc`.

## Запуск

```bash
cd frontend
npm ci
npm run dev
```

Открыть [http://127.0.0.1:4173/](http://127.0.0.1:4173/). Для работы нужен backend на `127.0.0.1:8000` с контрактом `questionnaire-v1`, Vite проксирует `/api` и `/openapi.json` автоматически (`vite.config.ts`). Поднять весь стек сразу можно через Docker по [корневому README](../README.md).

Собранный клиент проверяется через `npm run build`, затем `npm run preview` на порту 4174 с тем же прокси.

## Структура

```text
frontend/
  src/
    main.tsx                # единственная точка входа, монтирует FinancialProfileGate
    profile/                # интерфейс профиля: экраны, модель, API-адаптеры, печать A4
    shared/api.ts           # общий same-origin транспорт запросов
    base.css                # базовые стили
    app/                    # неподключенный код прежнего интерфейса дел, в сборку не входит
    legacy/                 # старый макет прототипа, сохранен для истории
  public/
    samples/                # учебные PDF и JSON-образцы, все лица и суммы вымышлены
    docs/                   # Swagger UI, копируется сборкой из tools/
  tests/                    # Playwright-спецификации и хелперы
  tools/                    # copy-docs, capture-скрипты, Swagger UI assets
  nginx.conf                # production-раздача: /api -> backend:8000, /docs/, CSP
  Dockerfile                # сборка клиента и раздача через nginx
```

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер Vite на `127.0.0.1:4173` |
| `npm run dev:prototype` | совместимая команда, тот же сервер и интерфейс |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `tsc -b` и production-сборка в `dist/` |
| `npm run preview` | раздача собранной версии на `127.0.0.1:4174` |
| `npm run format` / `format:check` | Prettier |
| `npm run test:prototype` | Playwright по `profile.spec.ts` и `documents-print.spec.ts` |
| `npm run test:visual` | визуальные снимки по `visual.spec.ts` |
| `npm run test:e2e` | интеграционные сценарии `flow.spec.ts`, нужен стек на `127.0.0.1:8080` |

## Тесты, честный статус на 22.11.2026

`npm run typecheck` и `npm run build` проходят.

| Набор | Конфиг | Результат | Причина падений |
|---|---|---|---|
| Профиль и печать, 23 теста | `playwright.prototype.config.ts` | 2 passed, 21 failed | сценарии подменяют только `/api/auth/*` и ждут прежний макет в памяти, текущий интерфейс читает пустой профиль из API |
| Визуальные, 4 теста | `playwright.visual.config.ts` | 0 passed, 4 failed | эталоны сняты с состояния UI до API-интеграции |
| e2e, 5 тестов | `playwright.config.ts` | 0 passed, 5 failed | `flow.spec.ts` описывает удаленный интерфейс дел и требует docker-стек на порту 8080 |

Падающие сценарии не адаптированы к новой модели и не входят в критерии приемки, их переработка отдельная задача. Контрактные проверки живут на стороне backend, 70 pytest-тестов проходят, смотрите [backend/README.md](../backend/README.md). Разбор прогона в [отчете](../docs/reports/test-run-2026-11-20.md).

## Как устроен профильный контур

- `profile/api.ts` и `model.ts`. Контракт `questionnaire-v1`, последовательное автосохранение с ревизиями, серверное подтверждение мутаций, конфликт ревизии без тихой перезаписи.
- `fields.ts`. Семь групп комплектности, условные поля, раздельные итоги резервисту и семье.
- `screens.tsx`, `editors.tsx`. Разделы резервиста и назначенные материалы проверяющего, сообщения, оценки, сигналы, история.
- `print.tsx`, `print.css`. Единая анкета A4 из всех разделов и три отдельные учебные заготовки.
- `documents.ts`, `signals.ts`. Работа с оригиналами и несоответствиями.

«Сохранено» в интерфейсе появляется только после ответа API. Личный черновик резервиста не виден проверяющему, тому доступны только назначенные представленные версии.

## Связанные документы

- [Корневой README](../README.md). Продукт, роли, сценарий, запуск.
- [backend/README.md](../backend/README.md). API, тесты, миграции.
- [docs/README.md](../docs/README.md). Отчеты и примеры. Детально по устройству клиента [отчет о состоянии](../docs/reports/client-status.md).
