# Резонанс

Прототип цифрового финансового профиля резервиста (хакатон, направление № 6). Только вымышленные данные; решения принимает уполномоченный специалист, система юридически значимых выводов не делает.

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

## Быстрый старт (frontend)

```bash
cd frontend
npm ci
npm run dev:prototype   # макет на http://127.0.0.1:4173/prototype
npm run dev             # интеграционный UI на :5173 (нужен backend на :8000)
```
