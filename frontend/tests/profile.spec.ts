import { test, expect } from '@playwright/test'
import {
  completeRequired, consentSample, demoPassword, fillDemo, loginAs, logout, nav,
  openDemoKit, openQueueItem, submitVersion, waitReady, waitSaved
} from './prototype.helpers'

test('login screen, wrong password is rejected, fresh reservist sees an empty server draft', async ({ page }) => {
  await page.goto('/prototype')
  await expect(page.getByLabel('Логин', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible()
  await page.getByLabel('Логин').fill('reservist1')
  await page.getByLabel('Пароль').fill('неверный-пароль')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await loginAs(page, 'reservist1')
  await expect(page.getByText('Серверный профиль пока пуст.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Заполнить пустой черновик демо-данными', exact: true })).toBeVisible()
})

test('demo fill loads the server draft, survives reload and unlocks the sections', async ({ page }) => {
  await loginAs(page, 'reservist2')
  await fillDemo(page)
  await expect(page.locator('.fp-person-header')).toContainText('Ковалёв Алексей Сергеевич')
  await expect(page.locator('.fp-person-header')).toContainText('kovalev@reservist.example')
  await expect(page.locator('.fp-person-header')).toContainText('Липецкая область')
  await page.reload()
  await waitReady(page)
  await expect(page.locator('.fp-person-header')).toContainText('Ковалёв Алексей Сергеевич')
  await nav(page, 'Выплаты и меры')
  await expect(page.locator('.fp-category-row')).toHaveCount(10)
  await nav(page, 'Документы')
  await page.getByRole('button', { name: 'Добавить учебный скан', exact: true }).click()
  await expect(page.locator('.fp-file').filter({ hasText: consentSample }).first()).toBeVisible()
  await nav(page, 'Версии и журнал')
  await expect(page.locator('.fp-audit-table')).toContainText('Личный черновик')
})

test('field edits are saved to the server draft and survive reload', async ({ page }) => {
  await loginAs(page, 'reservist3')
  await nav(page, 'Профиль и служба')
  await page.getByLabel('Фамилия, имя, отчество', { exact: true }).fill('Тестов Алексей Сергеевич')
  await expect(page.locator('.fp-sync-bar')).toContainText('Черновик сохранён на сервере', { timeout: 15_000 })
  await page.reload()
  await waitReady(page)
  await nav(page, 'Профиль и служба')
  await expect(page.getByLabel('Фамилия, имя, отчество', { exact: true })).toHaveValue('Тестов Алексей Сергеевич')
})

test('the consent scan is required in addition to the confirmation checkbox', async ({ page }) => {
  await loginAs(page, 'reservist4')
  await fillDemo(page)
  await nav(page, 'Самопроверка')
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('button', { name: 'Отправить на проверку', exact: true })).toBeDisabled()
  await nav(page, 'Документы')
  await page.getByRole('button', { name: 'Добавить учебный скан', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Добавить учебный скан', exact: true })).toHaveCount(0)
  await nav(page, 'Самопроверка')
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('button', { name: 'Отправить на проверку', exact: true })).toBeDisabled()
  await completeRequired(page)
  await nav(page, 'Самопроверка')
  await waitSaved(page)
  await page.getByRole('checkbox').check()
  await expect(page.getByRole('button', { name: 'Отправить на проверку', exact: true })).toBeEnabled()
})

test('a submitted version locks editing and reaches the assigned reviewer queue', async ({ page }) => {
  await loginAs(page, 'reservist5')
  await fillDemo(page)
  await nav(page, 'Профиль и служба')
  await page.getByLabel('Фамилия, имя, отчество', { exact: true }).fill('Отправнов Пять Тест')
  await expect(page.locator('.fp-sync-bar')).toContainText('Черновик сохранён на сервере', { timeout: 15_000 })
  await submitVersion(page)
  await nav(page, 'Главная')
  await expect(page.locator('.fp-person-labels .fp-badge')).toHaveText('Сведения представлены')
  await nav(page, 'Профиль и служба')
  await expect(page.getByLabel('Фамилия, имя, отчество', { exact: true })).toBeDisabled()
  await logout(page)
  await loginAs(page, 'reviewer')
  await expect(page.getByRole('row').filter({ hasText: 'Отправнов Пять Тест' })).toBeVisible()
})

test('private draft values stay invisible to the reviewer queue and demo kit', async ({ page }) => {
  await loginAs(page, 'reservist6')
  await nav(page, 'Профиль и служба')
  await page.getByLabel('Фамилия, имя, отчество', { exact: true }).fill('Личный Черновик Не Передан')
  await page.getByLabel('Электронная почта', { exact: true }).fill('private-only@reservist.example')
  await expect(page.locator('.fp-sync-bar')).toContainText('Черновик сохранён на сервере', { timeout: 15_000 })
  await logout(page)
  await loginAs(page, 'reviewer1')
  await expect(page.getByRole('heading', { name: 'Нет поступивших материалов' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Личный Черновик Не Передан')
  await expect(page.locator('body')).not.toContainText('private-only@reservist.example')
  await openDemoKit(page)
  await expect(page.locator('body')).not.toContainText('Личный Черновик Не Передан')
  await expect(page.locator('.fp-person-header')).not.toContainText('private-only@reservist.example')
})

test('reviewer accepts the demo kit, reviews a signal with a comment and assesses a document', async ({ page }) => {
  await loginAs(page, 'reviewer2')
  await openDemoKit(page)
  await page.getByRole('button', { name: 'Принять к рассмотрению', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Результат рассмотрения', exact: true })).toBeVisible()
  await nav(page, 'Карточка сигналов')
  const items = page.locator('.fp-signal-item')
  await expect(items.first()).toBeVisible()
  await items.first().click()
  const comment = 'Сигнал сопоставлен с учебными основаниями. Учебный комментарий проверяющего.'
  await page.getByLabel('Комментарий и вопрос кандидату в резерв', { exact: true }).fill(comment)
  await page.getByRole('button', { name: 'Отметить рассмотренным', exact: true }).click()
  await expect(items.first().locator('.fp-badge')).toHaveText('Рассмотрено')
  await expect(page.locator('.fp-review-record')).toContainText(comment)
  await nav(page, 'Документы и качество')
  const card = page.locator('.fp-file-card').first()
  await card.getByRole('button', { name: 'Оценить документ', exact: true }).click()
  await page.getByLabel('Оценка документа', { exact: true }).selectOption('Пригоден для сопоставления')
  await page.getByLabel('Комментарий к документу', { exact: true }).fill('Учебная оценка: файл читаемый, реквизиты на месте.')
  await page.getByRole('button', { name: 'Сохранить оценку', exact: true }).click()
  await expect(card.locator('.fp-document-assessment')).toContainText('Пригоден для сопоставления')
})

test('mobile profile sections do not overflow the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loginAs(page, 'reservist2')
  for (const name of ['Главная', 'Профиль и служба', 'Выплаты и меры', 'Документы', 'Самопроверка', 'Печать анкеты', 'Шаблоны и памятки']) {
    if (name !== 'Главная') {
      await page.getByRole('button', { name: 'Открыть меню', exact: true }).click()
      await nav(page, name)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
