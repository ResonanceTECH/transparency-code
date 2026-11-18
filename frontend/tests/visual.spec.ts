import { test, expect, type Page } from '@playwright/test'
import { nav, openPrototype, switchUser, finishRequiredFields, sendVersion } from './prototype.helpers'

test.beforeEach(async ({ page }) => {
  // Меняется время сценария, но не останавливаются таймеры React и анимации.
  await page.clock.setFixedTime(new Date('2026-11-19T09:15:00Z'))
})

async function shot(page: Page, name: string, fullPage = true) {
  await page.evaluate(async () => {
    await document.fonts.ready
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    window.scrollTo(0, 0)
  })
  await page.mouse.move(1400, 75)
  await expect(page.locator('.fp-toast')).toHaveCount(0)
  await expect(page).toHaveScreenshot(name, { fullPage })
}

test('reservist screens', async ({ page }) => {
  await openPrototype(page)
  await shot(page, 'reservist-home.png')
  await nav(page, 'Самопроверка')
  await shot(page, 'reservist-selfcheck.png')
  await nav(page, 'Документы')
  await shot(page, 'reservist-consent-documents.png')
  await nav(page, 'Печать анкеты')
  await shot(page, 'reservist-print-preview.png', false)
})

test('reviewer screens', async ({ page }) => {
  await openPrototype(page, 'reviewer')
  await shot(page, 'reviewer-empty-queue.png')
  await switchUser(page, 'reservist')
  await finishRequiredFields(page)
  await sendVersion(page)
  await switchUser(page, 'reviewer')
  await shot(page, 'reviewer-queue.png')
  await page.getByRole('button', { name: 'Открыть РВ-2026-0147', exact: true }).click()
  await shot(page, 'reviewer-case.png')
  await page.getByRole('button', { name: 'Проверить читаемость и подпись', exact: true }).click()
  await shot(page, 'reviewer-document-quality.png')
  await nav(page, 'Карточка сигналов')
  await shot(page, 'reviewer-signals.png')
})

test('educational templates', async ({ page }) => {
  await openPrototype(page)
  await nav(page, 'Шаблоны и памятки')
  await page.locator('.fp-template-card').filter({ hasText: 'Лист описания выплаты' }).click()
  await shot(page, 'template-payment-sheet.png')
})

test('mobile printable profile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPrototype(page)
  await page.getByRole('button', { name: 'Печать', exact: true }).click()
  await expect(page.locator('.fp-print-document')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await shot(page, 'mobile-print-preview.png', false)
})
