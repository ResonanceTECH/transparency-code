#set document(title: "Резонанс — ссылки и запуск", author: "Команда «Резонанс»")
#set page(paper: "a4", margin: (x: 2.2cm, y: 2.1cm), numbering: "1")
#set text(size: 10.5pt, lang: "ru", hyphenate: true)
#set heading(numbering: none)
#set par(justify: true, leading: 0.6em)

#let accent = rgb("#0f6f6a")
#let muted = rgb("#5a6a78")

#show heading.where(level: 1): it => {
  v(0.7em)
  block(stroke: (left: 3pt + accent), inset: (left: 10pt), it)
  v(0.3em)
}
#show heading.where(level: 2): it => { v(0.5em); it; v(0.1em) }

#show raw.where(block: true): it => block(
  fill: muted.lighten(92%), radius: 4pt, inset: 8pt, width: 100%,
  text(8.5pt, it),
)
#show raw.where(block: false): it => box(
  fill: muted.lighten(92%), radius: 3pt, inset: (x: 3pt, y: 1pt),
  text(9pt, it),
)

// ---------- Заголовок ----------
#text(11pt, fill: muted, tracking: 2pt, weight: "semibold")[ХАКАТОН «КОД ПРОЗРАЧНОСТИ» · РАНХиГС 2026 · НАПРАВЛЕНИЕ № 6]
#v(0.8em)
#text(24pt, weight: "bold", fill: accent)[РЕЗОНАНС]
#v(0.2em)
#text(13pt)[Цифровой финансовый профиль резервиста]
#v(0.3em)
#text(10pt, fill: muted)[Документ со ссылками и инструкцией запуска · все лица, документы и суммы вымышленные]

#v(0.6em)

= Основные ссылки

#table(
  columns: (5.6cm, 10.6cm),
  stroke: 0.5pt + muted.lighten(60%), inset: 6pt,
  fill: (_, y) => if y == 0 { muted.lighten(90%) },
  [*Назначение*], [*Ссылка*],
  [Репозиторий], [#link("https://github.com/ResonanceTECH/transparency-code")],
  [Рабочий прототип\ (HTTPS, Let's Encrypt через Caddy)], [#link("https://135.106.155.218.nip.io")],
  [Описание API (Swagger)], [#link("https://135.106.155.218.nip.io/docs/")],
  [Видеодемонстрация — папка на Google Диске], [#link("https://drive.google.com/drive/folders/1ZDhu66H5ODiLK5ClZtLpsWyNeRU80lzT?usp=sharing")],
)

#v(0.3em)
Развёртывание на сервере обновляется автоматически из ветки `main`.

= Демодоступ

Пароль у всех учебных аккаунтов: `resonance-demo-2026`

#table(
  columns: (4cm, 12.2cm),
  stroke: 0.5pt + muted.lighten(60%), inset: 6pt,
  fill: (_, y) => if y == 0 { muted.lighten(90%) },
  [*Логин*], [*Роль*],
  [`reservist`], [кандидат в резерв],
  [`reviewer`], [проверяющий],
  [`demo`], [специалист, тот же кабинет проверяющего],
)

#v(0.3em)
Быстрый показ: войти под `reviewer` и нажать «Открыть демо-комплект» — появится готовый представленный материал с версией, документами и сигналами.

= Инструкция запуска

Подробная версия — в корневом `README.md` репозитория. Ниже коротко: версии, зависимости, шаги.

#block(breakable: false)[
  == Версии и зависимости

  #table(
    columns: (7cm, 9.2cm),
    stroke: 0.5pt + muted.lighten(60%), inset: 6pt,
    fill: (_, y) => if y == 0 { muted.lighten(90%) },
    [*Способ*], [*Требования*],
    [Docker, весь стек одной командой], [Docker и Docker Compose],
    [Вручную], [Python 3.12+ · Node 22+ · npm 10+],
  )
]

#v(0.4em)
Основные зависимости: backend — FastAPI, SQLAlchemy 2, Alembic, Pydantic 2, PostgreSQL (или SQLite локально); frontend — React 19 и Vite. Точные диапазоны в `backend/pyproject.toml` и `frontend/package.json`.

== Шаги: Docker

1. Забрать код и перейти в каталог:

```bash
git clone https://github.com/ResonanceTECH/transparency-code.git
cd transparency-code
```

2. Скопировать `.env.example` в `.env` и заполнить `POSTGRES_PASSWORD` и `SECRET_KEY`:

```bash
cp .env.example .env
docker compose up -d --build --wait
```

3. Интерфейс открывается на порту `HTTP_PORT` из `.env`, по умолчанию `http://localhost:80/`, Swagger на `/docs/`. Миграции применяются при старте backend.

== Шаги: вручную

Backend на SQLite:

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

Во втором терминале клиент:

```bash
cd frontend
npm ci
npm run dev
```

Открыть http://127.0.0.1:4173/ — Vite проксирует `/api` на backend.

= Документация в репозитории

- Запуск, состав репозитория, проверки и тесты — `README.md`
- Устройство частей — `backend/README.md`, `frontend/README.md`
- Отчёты, примеры PDF и скриншоты — `docs/README.md`

#v(0.3em)
#align(center, text(8.5pt, fill: muted)[«Резонанс» · демонстрационный прототип · все данные вымышлены · документ сформирован 22.11.2026])
