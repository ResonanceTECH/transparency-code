import { chromium } from 'playwright'

const BASE = 'http://127.0.0.1:5173'
const PASS = 'resonance-demo-2026'
const results = []
const check = (name, ok, extra = '') => {
  results.push([name, ok])
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`)
}

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

async function login(user) {
  await page.goto(BASE + '/')
  await page.getByLabel('Логин').fill(user)
  await page.getByLabel('Пароль').fill(PASS)
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await page.waitForTimeout(1200)
}

// ---- резервист ----
await login('reservist')
check('reservist → workspace', await page.getByText('Финансовый профиль').first().isVisible().catch(() => false))
check('status completed', await page.getByText(/Рассмотрение завершено|Завершено/i).first().isVisible().catch(() => false))
check('completeness panel', await page.getByText(/Заполнение:/).first().isVisible().catch(() => false))
check('versions panel', await page.getByText('Версии представления').isVisible().catch(() => false))
check('contacts panel', await page.getByText('Ответственные операторы').isVisible().catch(() => false))
check('audit panel', await page.getByText('Журнал действий').isVisible().catch(() => false))
const docCount = await page.locator('.document').count()
check('documents rendered', docCount > 0, `${docCount} .document rows`)

// ---- reviewer ----
await page.getByRole('button', { name: 'Выйти' }).click().catch(() => {})
await page.waitForTimeout(800)
await login('reviewer')
check('reviewer → queue', await page.getByText('Профили на проверке').isVisible().catch(() => false))
const row = page.locator('.document').first()
check('queue has profile', await row.isVisible().catch(() => false))
await row.click()
await page.waitForTimeout(1200)
check('reviewer card', await page.getByText(/ПРОФИЛЬ ·/).first().isVisible().catch(() => false))
check('income summary panel', await page.getByText('Сведения о доходах').isVisible().catch(() => false))
check('snapshot panel', await page.getByText('Представленные сведения').isVisible().catch(() => false))
check('decisions panel', await page.getByText('Решения').first().isVisible().catch(() => false))
check('reviewer audit', await page.getByText('Журнал рассмотрения').isVisible().catch(() => false))
check('export button', await page.getByRole('button', { name: /JSON/ }).isVisible().catch(() => false))

await page.screenshot({ path: '/tmp/profile-reviewer.png', fullPage: false })
await browser.close()
const failed = results.filter(([, ok]) => !ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
process.exit(failed.length ? 1 : 0)
