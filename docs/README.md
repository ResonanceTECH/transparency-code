# Резонанс · docs

Документация прототипа «Резонанс». Запуск и общее описание в [корневом README](../README.md), устройство частей в [backend/README.md](../backend/README.md) и [frontend/README.md](../frontend/README.md).

## Актуальные отчеты

| Документ | Содержание |
|---|---|
| [Ссылки и запуск (PDF)](LINKS.pdf) | репозиторий, прототип, видеодемонстрация на Google Диске, демодоступ и шаги запуска, исходник [LINKS.typ](LINKS.typ) |
| [API-интеграция и миграция](reports/api-integration-2026-11-20.md) | контракт `questionnaire-v1`, миграция `c72f6a904e11`, проверки и порядок обновления развертывания |
| [Сверка требований](reports/requirements-reconciliation-2026-11-19.md) | реализация по двум документам требований, проверки и оставленные ограничения |
| [Состояние клиента](reports/client-status.md) | маршруты, модули и серверное хранение профиля |
| [Один интерфейс вместо двух](reports/single-interface-2026-11-20.md) | удаление старого UI дел без изменения backend и данных |
| [Прогон тестов](reports/test-run-2026-11-20.md) | результаты backend и Playwright, объяснение падений устаревших сценариев |
| [Отчет по продукту](reports/product-report.pdf) | описание продукта и клиентской части, исходник [product-report.typ](reports/product-report.typ) |

## Примеры и скриншоты

`examples/`. Учебные PDF, все лица, документы и суммы вымышлены. Актуальную анкету формирует интерфейс через «Печать анкеты», эти файлы статические заготовки.

- [Заполненная анкета A4](examples/whole-profile-a4.pdf)
- [Пустая учебная анкета](examples/template-blank-profile-a4.pdf)
- [Лист описания выплаты](examples/template-payment-sheet-a4.pdf)
- [Памятка по качеству скана](examples/template-scan-checklist-a4.pdf)

`screenshots/`. Снимки интерфейса, [кабинет резервиста](screenshots/reservist.png), [карточка у проверяющего](screenshots/reviewer.png), [самопроверка и отправка](screenshots/selfcheck.png).

## Архив

`reports/archive/` хранит исторические материалы. Отчеты до API-интеграции, прежний корневой README, служебная записка передачи [DARIA-HANDOFF.md](reports/archive/DARIA-HANDOFF.md) и [журнал итераций backend](reports/archive/backend-iterations-journal.md). Их результаты тестов относятся к прежним состояниям и не подтверждают текущую сборку.
