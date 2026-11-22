import { test, expect } from '@playwright/test'
import { demoDocument, fillDemo, loginAs, logout, nav, openQueueItem, submitVersion, waitSaved } from './prototype.helpers'

test.setTimeout(240_000)

test('full cycle: the reservist submits a version, the reviewer accepts, reviews and completes', async ({ page }) => {
  await loginAs(page, 'reservist')
  await fillDemo(page)
  await nav(page, 'Профиль и служба')
  await page.getByLabel('Фамилия, имя, отчество', { exact: true }).fill('Потоков Е2Е Тест')
  await expect(page.locator('.fp-sync-bar')).toContainText('Черновик сохранён на сервере', { timeout: 15_000 })
  await submitVersion(page)
  await logout(page)

  await loginAs(page, 'reviewer')
  await openQueueItem(page, 'Потоков Е2Е Тест')
  await page.getByRole('button', { name: 'Принять к рассмотрению', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Результат рассмотрения', exact: true })).toBeVisible()

  await nav(page, 'Карточка сигналов')
  const items = page.locator('.fp-signal-item')
  const signalCount = await items.count()
  expect(signalCount).toBeGreaterThan(0)
  for (let index = 0; index < signalCount; index += 1) {
    await items.nth(index).click()
    await page.getByLabel('Комментарий и вопрос кандидату в резерв', { exact: true })
      .fill(`Учебное рассмотрение сигнала ${index + 1}: основание сопоставлено человеком.`)
    await page.getByRole('button', { name: 'Отметить рассмотренным', exact: true }).click()
    await expect(items.nth(index).locator('.fp-badge')).toHaveText('Рассмотрено')
  }

  await nav(page, 'Документы и качество')
  const cards = page.locator('.fp-file-card')
  const documentCount = await cards.count()
  expect(documentCount).toBeGreaterThan(0)
  for (let index = 0; index < documentCount; index += 1) {
    await cards.nth(index).getByRole('button', { name: 'Оценить документ', exact: true }).click()
    await page.getByLabel('Оценка документа', { exact: true }).selectOption('Пригоден для сопоставления')
    await page.getByLabel('Комментарий к документу', { exact: true }).fill(`Учебная оценка документа ${index + 1}.`)
    await page.getByRole('button', { name: 'Сохранить оценку', exact: true }).click()
    await expect(cards.nth(index).locator('.fp-document-assessment')).toContainText('Пригоден для сопоставления')
  }

  await nav(page, 'Результат рассмотрения')
  await page.getByLabel('Итоговый статус профиля', { exact: true }).selectOption('Рассмотрение завершено')
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check()
  await page.getByLabel('Реквизиты подтверждающего основания', { exact: true }).fill('Учебный результат Е2Е/26 от 22.11.2026')
  await page.getByLabel('Комментарий к результату', { exact: true }).fill('Учебный цикл завершён: версия, сигналы и документы рассмотрены человеком.')
  await page.getByLabel('Подтверждающий документ результата').setInputFiles(demoDocument('Основание_результата_е2е.pdf'))
  await page.getByRole('button', { name: 'Зафиксировать итоговый статус', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Рассмотрение завершено', exact: true })).toBeVisible()
  await logout(page)

  await loginAs(page, 'reservist')
  await expect(page.locator('.fp-person-labels .fp-badge')).toHaveText('Рассмотрение завершено')
})

test('clarification: the reviewer question and reservist reply stay private until resubmission', async ({ page }) => {
  await loginAs(page, 'reservist1')
  await fillDemo(page)
  await nav(page, 'Профиль и служба')
  await page.getByLabel('Фамилия, имя, отчество', { exact: true }).fill('Уточняев Е2Е Второй')
  await expect(page.locator('.fp-sync-bar')).toContainText('Черновик сохранён на сервере', { timeout: 15_000 })
  await submitVersion(page)
  await logout(page)

  await loginAs(page, 'reviewer')
  await openQueueItem(page, 'Уточняев Е2Е Второй')
  await page.getByRole('button', { name: 'Принять к рассмотрению', exact: true }).click()
  await nav(page, 'Карточка сигналов')
  await page.locator('.fp-signal-item').first().click()
  await page.getByLabel('Комментарий и вопрос кандидату в резерв', { exact: true })
    .fill('Уточните основание выплаты и приложите актуальный документ.')
  await page.getByRole('button', { name: 'Запросить уточнение', exact: true }).click()
  await nav(page, 'Карточка кандидата в резерв')
  await expect(page.locator('.fp-person-labels .fp-badge')).toHaveText('Требуется уточнение')
  await logout(page)

  await loginAs(page, 'reservist1')
  await nav(page, 'Уточнения')
  await expect(page.locator('body')).toContainText('Уточните основание выплаты')
  await page.getByLabel('Пояснение кандидата в резерв', { exact: true })
    .fill('Учебное пояснение: основание уточнено, документ приложен в новой версии.')
  await page.getByRole('button', { name: 'Подготовить версию 2', exact: true }).click()
  await nav(page, 'Самопроверка')
  await waitSaved(page)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Отправить на проверку', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Версия передана на рассмотрение' })).toBeVisible()
  await logout(page)

  await loginAs(page, 'reviewer')
  await openQueueItem(page, 'Уточняев Е2Е Второй')
  await expect(page.locator('.fp-person-labels .fp-badge')).toHaveText('Сведения представлены повторно')
  await nav(page, 'Запросы уточнений')
  await expect(page.locator('body')).toContainText('Учебное пояснение')
})
