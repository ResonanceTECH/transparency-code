import { test, expect, type Page } from '@playwright/test'
import { fillDemo, loginAs, nav, openDemoKit } from './prototype.helpers'

test.beforeEach(async ({ page }) => {
  // Фиксируем клиентское время; серверные метки (аудит, даты версий) маскируем.
  await page.clock.setFixedTime(new Date('2026-11-19T09:15:00Z'))
})

const dynamic = (page: Page) => [
  page.locator('.fp-recent-actions'),
  page.locator('.fp-toast'),
  page.locator('.fp-main').getByText(/\d{2}\.\d{2}\.\d{4}/),
]

async function shot(page: Page, name: string, fullPage = true) {
  await page.evaluate(async () => {
    await document.fonts.ready
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.scrollTo(0, 0)
  })
  await page.mouse.move(1400, 75)
  await expect(page).toHaveScreenshot(name, { fullPage, mask: dynamic(page) })
}

test('login screen', async ({ page }) => {
  await page.goto('/prototype')
  await expect(page.getByLabel('Пароль', { exact: true })).toBeVisible()
  await shot(page, 'login.png')
})

test('reservist home after demo fill', async ({ page }) => {
  await loginAs(page, 'reservist2')
  await fillDemo(page)
  await shot(page, 'reservist-home.png')
})

test('reservist selfcheck of a complete draft', async ({ page }) => {
  await loginAs(page, 'reservist2')
  await nav(page, 'Самопроверка')
  await shot(page, 'reservist-selfcheck.png')
})

test('reviewer demo kit case', async ({ page }) => {
  await loginAs(page, 'reviewer1')
  await openDemoKit(page)
  await shot(page, 'reviewer-case.png')
})
