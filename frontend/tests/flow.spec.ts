import { test, expect } from '@playwright/test'

test('trade-in: import, confirmation, analysis, decision, edit and reanalysis', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('/')
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Обзор проверок' })).toBeVisible()
  await page.getByRole('button', { name: 'Trade-in автомобиля' }).click()
  await expect(page.getByRole('heading', { name: 'Исходные сведения' })).toBeVisible()
  await expect(page.getByText('Нужна сверка', { exact: true }).first()).toBeVisible()
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Подтвердить все после сверки' }).click()
  await page.getByRole('button', { name: 'Запустить анализ' }).click()
  await expect(page.getByRole('heading', { name: 'Возможный пропуск дохода от продажи' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Различаются остатки обязательства' })).toBeVisible()
  await page.getByRole('button', { name: 'Разобрать' }).first().click()
  await page.getByLabel('Комментарий к рассмотрению').fill('Сопоставлен учебный договор. Нужно уточнение сведений.')
  await page.getByRole('button', { name: 'Запросить дополнительные сведения' }).click()
  await expect(page.getByText('Запрошено уточнение', { exact: true }).first()).toBeVisible()
  await page.getByRole('navigation').getByRole('button', { name: 'Документы', exact: true }).click()
  const row = page.getByRole('row').filter({ hasText: 'Доход от продажи в справке' })
  await row.getByRole('button', { name: 'Уточнить' }).click()
  await page.getByLabel('Значение', { exact: true }).fill('900000')
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  await expect(page.getByText('Сведения изменены после анализа.', { exact: false }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Запустить анализ' }).click()
  await expect(page.getByRole('heading', { name: 'Возможный пропуск дохода от продажи' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Различаются остатки обязательства' })).toBeVisible()
  await page.getByRole('button', { name: 'Правила проверки', exact: true }).click()
  await page.getByRole('switch', { name: 'Сопоставление обязательств' }).click()
  await page.getByRole('button', { name: 'Выполнить новый анализ дела', exact: false }).click()
  await expect(page.getByRole('heading', { name: 'Сигналов по выбранным правилам нет' })).toBeVisible()
  await page.getByRole('button', { name: 'Рабочий итог' }).click()
  await expect(page.getByRole('heading', { name: 'Результаты предварительного анализа сведений' })).toBeVisible()
  expect(errors).toEqual([])
})

test('profile: reservist publishes draft, reviewer requests clarification', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  // Вход резервиста
  await page.goto('/')
  await page.getByLabel('Логин').fill('reservist')
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByText('ФИНАНСОВЫЙ ПРОФИЛЬ')).toBeVisible()
  // Анкета и поток (веха 10%)
  await page.getByLabel('ФИО').fill('Е2Е Тестовая Кандидатка')
  await page.getByLabel('Год рождения').fill('1990')
  await page.getByLabel('Телефон').fill('+7 900 000-00-00')
  await page.getByLabel('E-mail').fill('e2e@demo.ru')
  await page.getByLabel('Текущее место работы').fill('ГБУ «Учебное»')
  await page.getByLabel('Поток', { exact: true }).fill('Время героев')
  await page.getByLabel('Год программы').fill('2025')
  await page.getByLabel('Регион', { exact: true }).fill('Липецкая область')
  await page.getByLabel('Акт о зачислении №').fill('Акт-Е2Е/001')
  await page.getByLabel('Дата акта').fill('2025-04-01')
  // Служба (веха 50%)
  await page.getByRole('button', { name: 'Добавить', exact: true }).first().click()
  await page.getByLabel('Начало').fill('2019-01-01')
  await page.getByLabel('Окончание').fill('2023-12-31')
  // Родство: есть родственник, но выплаты заявлены без записей → несоответствие
  await page.getByLabel('Есть родственник — участник СВО?').selectOption('true')
  await page.getByLabel('Получали ли выплаты родственники?').selectOption('true')
  await page.getByRole('button', { name: 'Добавить родственника' }).click()
  await page.getByLabel('ФИО').nth(1).fill('Тестов И.И.')
  await page.getByLabel('Степень родства').selectOption('spouse')
  // Ответы по всем категориям выплат (веха 70%) — «Нет»
  const answers = page.locator('.panel select')
  for (const select of await page.locator('select').all()) {
    if ((await select.getAttribute('disabled')) === null) {
      const opts = await select.locator('option').allTextContents()
      if (opts.join(' ').includes('Планируется')) await select.selectOption('no')
    }
  }
  // Диплом (веха 30%)
  await page.locator('input[type="file"]').setInputFiles({
    name: 'diploma.json', mimeType: 'application/json',
    buffer: Buffer.from('{"synthetic": true, "kind": "diploma"}')
  })
  await page.getByRole('button', { name: 'Сохранить черновик' }).click()
  await expect(page.getByText('Заполнение: 90%')).toBeVisible()
  await page.getByRole('button', { name: 'Представить сведения' }).click()
  await expect(page.getByText('Версия 1')).toBeVisible()
  // Выход и вход проверяющего
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.getByLabel('Логин').fill('reviewer')
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Профили на проверке' })).toBeVisible()
  await page.getByText('Е2Е Тестовая Кандидатка').click()
  await expect(page.getByText('Заявлены выплаты родственникам, записей нет')).toBeVisible()
  // Решение: уточнение — резервист получает вопрос
  await page.getByLabel('Комментарий (обязателен, ≥ 5 символов)').fill('Уточните записи о выплатах родственникам')
  await page.getByRole('button', { name: 'Требуются уточнения' }).click()
  await expect(page.getByText('ТРЕБУЕТСЯ УТОЧНЕНИЕ')).toBeVisible()
  // Резервист видит вопрос и статус
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.getByLabel('Логин').fill('reservist')
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByText('ТРЕБУЕТСЯ УТОЧНЕНИЕ')).toBeVisible()
  await expect(page.getByText('Уточните записи о выплатах родственникам')).toBeVisible()
  expect(errors).toEqual([])
})

test('mobile shell is usable and does not overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Обзор проверок' })).toBeVisible()
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflows).toBe(false)
})

test('upload new JSON file and download actual analysis result', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await page.getByRole('navigation').getByRole('button', { name: 'Новая проверка' }).click()
  await page.getByLabel('Имя в демонстрационном комплекте').fill('Тест загрузки · вымышленное лицо')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Создать дело и перейти к документам' }).click()
  const payload = { synthetic: true, facts: [{ field: 'sale_amount', value: '123456', object_id: 'uploaded-car', date: '2025-10-01', unit: 'RUB', snippet: 'Учебный загруженный документ: 123456 руб.' }] }
  await page.getByLabel('Загрузить документ').setInputFiles({ name: 'uploaded-synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(payload)) })
  await expect(page.getByText('uploaded-synthetic.json', { exact: true }).first()).toBeVisible()
  page.once('dialog', d => d.accept())
  await page.getByRole('button', { name: 'Подтвердить все после сверки' }).click()
  await page.getByRole('button', { name: 'Запустить анализ' }).click()
  await expect(page.getByRole('heading', { name: 'Возможный пропуск дохода от продажи' })).toBeVisible()
  await page.getByRole('button', { name: 'Рабочий итог' }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'JSON', exact: true }).click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/^PR-.*\.json$/)
  expect(await file.failure()).toBeNull()
})

test('API documentation works with external requests blocked and strict CSP', async ({ page }) => {
  const external: string[] = []
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.route('**/*', route => {
    const url = new URL(route.request().url())
    if (['http:', 'https:'].includes(url.protocol) && url.origin !== 'http://127.0.0.1:8080') {
      external.push(url.href)
      return route.abort()
    }
    return route.continue()
  })
  const response = await page.goto('/docs')
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'")
  await expect(page.locator('.swagger-ui .info .title')).toContainText('Резонанс · синтетический прототип')
  await expect(page.locator('.swagger-ui')).toContainText('/api/health')
  expect(external).toEqual([])
  expect(errors).toEqual([])
})
