import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

export const supportSample = 'Решение_региональная_поддержка_демо.pdf'
export const consentSample = 'Согласие_ПДн_учебный.pdf'
export const demoPassword = 'resonance-demo-2026'

// Валидный синтетический PDF из public/samples — проходит проверку контейнера.
export const demoDocument = (name: string, sample = supportSample) => ({
  name,
  mimeType: 'application/pdf',
  buffer: readFileSync(new URL(`../public/samples/${sample}`, import.meta.url))
})

export const nav = (page: Page, name: string) =>
  page.getByRole('navigation').getByRole('button', { name, exact: true }).click()

// Ждём, пока модель прочитает профиль, версии, сигналы и журнал с сервера.
export async function waitReady(page: Page) {
  await expect(page.locator('.fp-shell')).toBeVisible()
  await expect(page.getByText('Загрузка с сервера')).toHaveCount(0)
  await expect(page.getByText('Загружаем данные с сервера')).toHaveCount(0)
}

export async function loginAs(page: Page, username: string, password = demoPassword) {
  await page.goto('/prototype')
  await page.getByLabel('Логин', { exact: true }).fill(username)
  await page.getByLabel('Пароль', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await waitReady(page)
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page.getByLabel('Логин', { exact: true })).toBeVisible()
}

// Серверный черновик заполняется демо-данными через POST /profile/demo.
export async function fillDemo(page: Page) {
  const button = page.getByRole('button', { name: 'Заполнить пустой черновик демо-данными', exact: true })
  if (await button.isVisible().catch(() => false)) await button.click()
  await expect(page.locator('.fp-person-header')).toContainText('Ковалёв', { timeout: 20_000 })
  await waitSaved(page)
}

// Учебный скан согласия прикрепляется серверной кнопкой, если профиль его ещё не содержит.
export async function ensureConsent(page: Page) {
  await nav(page, 'Документы')
  const sample = page.getByRole('button', { name: 'Добавить учебный скан', exact: true })
  if (await sample.count()) {
    await sample.click()
    await expect(sample).toHaveCount(0)
    await waitSaved(page)
  }
}

export const category = (page: Page, text: string) =>
  page.locator('.fp-category-row').filter({ hasText: text }).click()

// Демо-заполнение намеренно оставляет три обязательных пробела:
// документ у записи региональной поддержки, год в жилищных мерах и скан согласия.
export async function completeRequired(page: Page) {
  await nav(page, 'Выплаты и меры')
  await category(page, 'Федеральная, региональная и муниципальная поддержка')
  await page.getByLabel('Документ для региональной поддержки').setInputFiles(demoDocument('Региональная_поддержка_демо.pdf'))
  await expect(page.locator('.fp-file').filter({ hasText: 'Региональная_поддержка_демо.pdf' }).first()).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Сохранить и вернуться', exact: true }).click()
  await waitSaved(page)
  await category(page, 'Жилищные меры')
  await page.getByLabel('Предполагаемый год приобретения', { exact: true }).fill('2028')
  await page.getByRole('button', { name: 'Сохранить и вернуться', exact: true }).click()
  await waitSaved(page)
}

// Автосохранение с дебаунсом перерисовывает форму во время PUT. Перед шагами,
// зависящими от стабильного DOM, ждём подтверждённого сервером состояния.
export async function waitSaved(page: Page) {
  await expect(page.locator('.fp-sync-bar')).toContainText('Черновик сохранён на сервере', { timeout: 15_000 })
}

export async function submitVersion(page: Page) {
  await completeRequired(page)
  await ensureConsent(page)
  await nav(page, 'Самопроверка')
  await waitSaved(page)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Отправить на проверку', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Версия передана на рассмотрение' })).toBeVisible()
}

// Проверяющий открывает строку очереди по уникальному тексту в ней.
export async function openQueueItem(page: Page, marker: string) {
  const row = page.getByRole('row').filter({ hasText: marker })
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.getByRole('button', { name: /Открыть/ }).click()
  await expect(page.locator('.fp-person-header')).toBeVisible({ timeout: 15_000 })
}

export async function openDemoKit(page: Page) {
  await page.getByRole('button', { name: 'Открыть демо-комплект', exact: true }).click()
  await expect(page.locator('.fp-person-header')).toContainText('Ковалёв', { timeout: 20_000 })
}
