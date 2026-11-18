import { expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'

export const supportSample = 'Решение_региональная_поддержка_демо.pdf'
export const consentSample = 'Согласие_ПДн_учебный.pdf'

// Валидный синтетический PDF с каталогом страниц и xref, а не только %PDF в начале.
export const demoDocument = (name: string, sample = supportSample) => ({
  name,
  mimeType: 'application/pdf',
  buffer: readFileSync(new URL(`../public/samples/${sample}`, import.meta.url))
})
export const nav = (page: Page, name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
export const category = (page: Page, text: string) => page.locator('.fp-category-row').filter({ hasText: text }).click()

type DemoAccount = 'reservist' | 'reviewer' | 'demo'
const users: Record<DemoAccount, { username: string; display_name: string; role: string }> = {
  reservist: { username: 'reservist', display_name: 'Алексей Ковалёв', role: 'reservist' },
  reviewer: { username: 'reviewer', display_name: 'Анна Иванова', role: 'reviewer' },
  demo: { username: 'demo', display_name: 'Демо-специалист', role: 'specialist' }
}

export async function mockAuth(page: Page) {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { authenticated: false, user: null } }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ json: {} }))
  await page.route('**/api/auth/login', (route) => {
    const body = route.request().postDataJSON() as { username: DemoAccount; password: string }
    const user = users[body.username]
    if (user && body.password === 'resonance-demo-2026') return route.fulfill({ json: user })
    return route.fulfill({ status: 401, json: { detail: 'Неверный логин или пароль' } })
  })
}

export async function loginAs(page: Page, name: DemoAccount) {
  await page.getByLabel('Логин').fill(name)
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.locator('.fp-shell')).toBeVisible()
}

export async function openPrototype(page: Page, name: DemoAccount = 'reservist') {
  await mockAuth(page)
  await page.goto('/prototype')
  await loginAs(page, name)
}

export async function switchUser(page: Page, name: DemoAccount) {
  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await expect(page.locator('.fp-shell')).toHaveCount(0)
  await loginAs(page, name)
}

export async function finishRequiredFields(page: Page) {
  await nav(page, 'Выплаты и меры')
  await category(page, 'Федеральная, региональная и муниципальная поддержка')
  await page.getByLabel('Документ для региональной поддержки').setInputFiles(demoDocument('Региональная_поддержка_демо.pdf'))
  await expect(page.locator('.fp-file')).toContainText('Региональная_поддержка_демо.pdf')
  await page.getByRole('button', { name: 'Сохранить и вернуться', exact: true }).click()
  await category(page, 'Жилищные меры')
  await page.getByLabel('Предполагаемый год приобретения', { exact: true }).fill('2028')
  await page.getByRole('button', { name: 'Сохранить и вернуться', exact: true }).click()
  await nav(page, 'Документы')
  await page.getByLabel('Подписанный скан согласия на обработку ПДн', { exact: true }).setInputFiles(demoDocument(consentSample, consentSample))
  await expect(page.getByRole('button', { name: 'Добавить учебный скан', exact: true })).toHaveCount(0)
  await nav(page, 'Самопроверка')
}

export async function sendVersion(page: Page) {
  await page.getByRole('checkbox', { name: 'Я проверил сведения и подтверждаю передачу этой версии уполномоченному специалисту' }).check()
  await page.getByRole('button', { name: 'Отправить на проверку', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Версия передана на рассмотрение' })).toBeVisible()
}

export async function openForReview(page: Page) {
  await switchUser(page, 'reviewer')
  await page.getByRole('button', { name: 'Открыть РВ-2026-0147', exact: true }).click()
  await page.getByRole('button', { name: 'Принять к рассмотрению', exact: true }).click()
}
