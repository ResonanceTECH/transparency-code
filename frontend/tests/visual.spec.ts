import { test, expect, type Page } from '@playwright/test'

const users: Record<string, { username: string; display_name: string; role: string }> = {
  reservist: { username: 'reservist', display_name: 'Алексей Ковалёв', role: 'reservist' },
  reviewer: { username: 'reviewer', display_name: 'Анна Иванова', role: 'reviewer' }
}

async function mockAuth(page: Page) {
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { authenticated: false, user: null } }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ json: {} }))
  await page.route('**/api/auth/login', (route) => {
    const body = route.request().postDataJSON() as { username: string; password: string }
    const user = users[body.username]
    if (user && body.password === 'resonance-demo-2026') return route.fulfill({ json: user })
    return route.fulfill({ status: 401, json: { detail: 'Неверный логин или пароль' } })
  })
}

async function login(page: Page, name: 'reservist' | 'reviewer') {
  await page.getByLabel('Логин').fill(name)
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.locator('.fp-shell')).toBeVisible()
}

async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready)
  await expect(page.locator('.fp-toast')).toHaveCount(0)
  await expect(page).toHaveScreenshot(name, { fullPage: true })
}

test('reservist screens', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/prototype')
  await login(page, 'reservist')
  await shot(page, 'reservist-home.png')
  await page.getByRole('navigation').getByRole('button', { name: 'Самопроверка', exact: true }).click()
  await shot(page, 'reservist-selfcheck.png')
})

test('reviewer screens', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/prototype')
  await login(page, 'reviewer')
  await shot(page, 'reviewer-empty-queue.png')

  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await login(page, 'reservist')
  const nav = (name: string) => page.getByRole('navigation').getByRole('button', { name, exact: true }).click()
  const category = (text: string) => page.locator('.fp-category-row').filter({ hasText: text }).click()
  await nav('Выплаты и меры')
  await category('Федеральная, региональная и муниципальная поддержка')
  await page.getByLabel('Документ для региональной поддержки').setInputFiles({
    name: 'demo.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4')
  })
  await page.getByRole('button', { name: 'Сохранить и вернуться', exact: true }).click()
  await category('Жилищные меры')
  await page.getByLabel('Предполагаемый год приобретения', { exact: true }).fill('2028')
  await page.getByRole('button', { name: 'Сохранить и вернуться', exact: true }).click()
  await nav('Самопроверка')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Отправить на проверку', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Версия передана на рассмотрение' })).toBeVisible()

  await page.getByRole('button', { name: 'Выйти', exact: true }).click()
  await login(page, 'reviewer')
  await shot(page, 'reviewer-queue.png')
  await page.getByRole('row').filter({ hasText: 'Ковалёв Алексей Сергеевич' }).getByRole('button', { name: /Открыть/ }).click()
  await shot(page, 'reviewer-case.png')
})
