// Historical capture script for the previous mockup; use screenshots:prototype for the current UI.
import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const baseUrl = process.env.PROTOTYPE_URL || 'http://127.0.0.1:4173/prototype'
const output = resolve(process.env.SCREENSHOT_DIR || 'screenshots/mvp')
await mkdir(output, { recursive: true })

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 })

async function capture(name) {
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: resolve(output, name), fullPage: true })
}

await page.goto(baseUrl, { waitUntil: 'networkidle' })
await capture('01-reservist-dashboard.png')

await page.getByRole('button', { name: 'Мой профиль' }).click()
await capture('02-reservist-profile.png')

await page.getByRole('button', { name: 'Выплаты и меры' }).click()
await capture('03-reservist-payments.png')

await page.getByRole('button', { name: 'Деятельность' }).click()
await capture('04-reservist-activities.png')

await page.getByRole('button', { name: 'Самопроверка' }).click()
await capture('05-reservist-selfcheck.png')

await page.getByRole('button', { name: 'Проверяющий' }).click()
await capture('06-reviewer-queue.png')

await page.getByText('Ковалёв Алексей Сергеевич', { exact: true }).last().click()
await capture('07-reviewer-profile.png')

await page.getByRole('button', { name: /Открыть сигналы/ }).click()
await capture('08-reviewer-signals.png')

await browser.close()
console.log(`Screenshots saved to ${output}`)
