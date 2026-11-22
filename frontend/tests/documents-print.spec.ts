import { test, expect } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import {
  completeRequired, consentSample, demoDocument, fillDemo, loginAs, logout, nav, openQueueItem, submitVersion
} from './prototype.helpers'

const pngDocument = {
  name: 'Подписанный_учебный_скан.png', mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGMQSGgAAAF0APFOODEtAAAAAElFTkSuQmCC', 'base64')
}
// Настоящий DOCX из tests/files — проходит проверку контейнера и на сервере.
const docxDocument = {
  name: 'Учебное_основание.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  buffer: readFileSync(new URL('./files/Учебное_основание.docx', import.meta.url))
}

test('a basis document uploads, previews, downloads identical bytes and deletes', async ({ page }) => {
  await loginAs(page, 'reservist7')
  await nav(page, 'Документы')
  const file = demoDocument('Учебное_основание_Р7.pdf')
  await page.getByLabel('Дополнительный документ основания', { exact: true }).setInputFiles(file)
  await expect(page.locator('.fp-document-table')).toContainText(file.name)
  await page.getByRole('button', { name: `Просмотреть ${file.name}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.locator('iframe')).toBeVisible()
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('link', { name: 'Скачать', exact: true }).click()
  expect(await readFile((await (await downloadPromise).path())!)).toEqual(file.buffer)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: `Удалить ${file.name}`, exact: true }).click()
  await expect(page.locator('.fp-document-table')).not.toContainText(file.name)
})

test('invalid files are rejected with clear errors and never reach the server', async ({ page }) => {
  await loginAs(page, 'reservist8')
  await nav(page, 'Документы')
  const input = page.getByLabel('Дополнительный документ основания', { exact: true })
  const invalidFiles = [
    { name: 'empty.pdf', buffer: Buffer.alloc(0), error: 'Файл пуст' },
    { name: 'large.pdf', buffer: Buffer.alloc(5 * 1024 * 1024 + 1), error: 'Файл больше 5 МБ' },
    { name: 'old-format.doc', buffer: Buffer.from('old format'), error: 'Недопустимый формат' },
    { name: 'renamed.pdf', buffer: Buffer.from('not a PDF'), error: 'Содержимое не соответствует формату' },
    { name: 'incomplete.pdf', buffer: Buffer.from('%PDF-1.4\nmissing EOF'), error: 'Содержимое не соответствует формату' },
    { name: 'archive.docx', buffer: Buffer.from('PK\x03\x04 unrelated archive'), error: 'Содержимое не соответствует формату' }
  ]
  for (const file of invalidFiles) {
    await input.setInputFiles({ name: file.name, mimeType: 'application/octet-stream', buffer: file.buffer })
    await expect(page.getByText(file.error, { exact: false }).first()).toBeVisible()
    await expect(page.locator('.fp-file-card')).toHaveCount(0)
  }
  await input.setInputFiles(demoDocument('Валидное_основание_Р8.pdf'))
  await expect(page.locator('.fp-document-table')).toContainText('Валидное_основание_Р8.pdf')
})

test('consent accepts image scans; docx gets a truthful download-only fallback', async ({ page }) => {
  await loginAs(page, 'reservist9')
  await nav(page, 'Документы')
  await page.getByLabel('Подписанный скан согласия на обработку ПДн', { exact: true }).setInputFiles(pngDocument)
  await expect(page.getByRole('button', { name: 'Добавить учебный скан', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: `Просмотреть ${pngDocument.name}`, exact: true }).first().click()
  await expect(page.getByRole('dialog').getByRole('img', { name: `Скан ${pngDocument.name}`, exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByLabel('Дополнительный документ основания', { exact: true }).setInputFiles(docxDocument)
  await expect(page.locator('.fp-document-table')).toContainText(docxDocument.name, { timeout: 15_000 })
  await page.getByRole('button', { name: `Просмотреть ${docxDocument.name}`, exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('встроенный просмотр недоступен')
  const downloadPromise = page.waitForEvent('download')
  await dialog.getByRole('link', { name: 'Скачать', exact: true }).click()
  expect(await readFile((await (await downloadPromise).path())!)).toEqual(docxDocument.buffer)
})

test('the printable questionnaire reflects the server draft and exports a real PDF', async ({ page }) => {
  await loginAs(page, 'reservist10')
  await fillDemo(page)
  await completeRequired(page)
  await nav(page, 'Документы')
  await page.getByRole('button', { name: 'Добавить учебный скан', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Добавить учебный скан', exact: true })).toHaveCount(0)
  await nav(page, 'Печать анкеты')
  const printed = page.locator('.fp-print-document')
  for (const value of ['Ковалёв Алексей Сергеевич', 'Заполнено 7 из 7', consentSample, 'Липецкая область']) {
    await expect(printed).toContainText(value)
  }
  await page.evaluate(() => { window.print = () => { document.body.dataset.printCalls = '1' } })
  await page.getByRole('button', { name: 'Печать / сохранить PDF', exact: true }).click()
  expect(await page.evaluate(() => document.body.dataset.printCalls)).toBe('1')
  await page.emulateMedia({ media: 'print' })
  for (const selector of ['.fp-sidebar', '.fp-topbar', '.fp-footer', '.fp-print-toolbar']) {
    await expect(page.locator(selector)).toBeHidden()
  }
  await expect(printed).toBeVisible()
  const pdf = await page.pdf({ format: 'A4', preferCSSPageSize: true, printBackground: true })
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
})

test('reviewer print and JSON export contain the immutable submitted version only', async ({ page }) => {
  await loginAs(page, 'reservist11')
  await fillDemo(page)
  await nav(page, 'Профиль и служба')
  await page.getByLabel('Фамилия, имя, отчество', { exact: true }).fill('Приватов Тест Один')
  await expect(page.locator('.fp-sync-bar')).toContainText('Черновик сохранён на сервере', { timeout: 15_000 })
  await submitVersion(page)
  await nav(page, 'Печать анкеты')
  await expect(page.locator('.fp-print-document')).toContainText('Приватов Тест Один')
  await logout(page)
  await loginAs(page, 'reviewer')
  await openQueueItem(page, 'Приватов Тест Один')
  await nav(page, 'Печать анкеты')
  await expect(page.getByLabel('Данные для печати', { exact: true })).toHaveCount(0)
  await expect(page.locator('.fp-print-document')).toContainText('Приватов Тест Один')
  await expect(page.locator('.fp-print-document')).toContainText('Представленная версия 1')
  await nav(page, 'Результат рассмотрения')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Выгрузить учебный результат', exact: true }).click()
  const download = await downloadPromise
  const payload = JSON.parse(await readFile((await download.path())!, 'utf8'))
  expect(JSON.stringify(payload)).toContain('Приватов Тест Один')
})
