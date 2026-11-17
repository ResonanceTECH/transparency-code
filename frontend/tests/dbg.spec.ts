import { test } from '@playwright/test'
test('dbg', async ({ page }) => {
  page.on('request', r => { if (r.method() === 'PUT') console.log('PUT BODY:', r.postData()?.slice(0, 2000)) })
  page.on('response', async r => { if (r.url().includes('/profile') && r.request().method() === 'PUT') console.log('PUT RESP:', r.status()) })
  await page.goto('/')
  await page.getByLabel('Логин').fill('reservist')
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await page.getByText('ФИНАНСОВЫЙ ПРОФИЛЬ').waitFor()
  await page.getByRole('button', { name: 'Сохранить черновик' }).waitFor()
  const paymentsPanel = page.locator('section.panel', { hasText: 'Выплаты и меры поддержки' })
  const selects = paymentsPanel.locator('select')
  console.log('SELECT COUNT:', await selects.count())
  for (let i = 0; i < await selects.count(); i++) {
    await selects.nth(i).selectOption('no')
    console.log('after select', i, 'value =', await selects.nth(i).inputValue())
  }
  await page.getByRole('button', { name: 'Сохранить черновик' }).click()
  await page.waitForTimeout(1500)
})
