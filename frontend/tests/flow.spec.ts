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
  // Анкета и поток (веха 10%) — селекторы привязаны к панели: у родственника тоже есть «ФИО»
  const anketa = page.locator('section.panel', { hasText: 'Анкета и поток' })
  await anketa.getByLabel('ФИО').fill('Е2Е Тестовая Кандидатка')
  await anketa.getByLabel('Год рождения').fill('1990')
  await anketa.getByLabel('Телефон').fill('+7 900 000-00-00')
  await anketa.getByLabel('E-mail').fill('e2e@demo.ru')
  await anketa.getByLabel('Текущее место работы').fill('ГБУ «Учебное»')
  await anketa.getByLabel('Поток', { exact: true }).fill('Время героев')
  await anketa.getByLabel('Год программы').fill('2025')
  await anketa.getByLabel('Регион', { exact: true }).fill('Липецкая область')
  await anketa.getByLabel('Акт о зачислении №').fill('Акт-Е2Е/001')
  await anketa.getByLabel('Дата акта').fill('2025-04-01')
  // Служба (веха 50%) — добавляем период, если список пуст
  const service = page.locator('section.panel', { hasText: 'Периоды службы' })
  if (await service.getByLabel('Начало').count() === 0) {
    await service.getByRole('button', { name: 'Добавить' }).click()
  }
  await service.getByLabel('Начало').first().fill('2019-01-01')
  await service.getByLabel('Окончание').first().fill('2023-12-31')
  // Родство: есть родственник, выплаты заявлены без записей → несоответствие
  const kinship = page.locator('section.panel', { hasText: 'Родство с участником СВО' })
  await kinship.getByLabel('Есть родственник — участник СВО?').selectOption('true')
  await kinship.getByLabel('Получали ли выплаты родственники?').selectOption('true')
  if ((await kinship.getByLabel('ФИО').count()) === 0) {
    await kinship.getByRole('button', { name: 'Добавить родственника' }).click()
  }
  await kinship.getByLabel('ФИО').first().fill('Тестов И.И.')
  await kinship.getByLabel('Степень родства').first().selectOption('spouse')
  // Ответы по всем категориям выплат (веха 70%) — «Нет»
  const paymentsPanel = page.locator('.panel', { hasText: 'Выплаты и меры поддержки' })
  const answerSelects = paymentsPanel.locator('select')
  for (let i = 0; i < await answerSelects.count(); i++) {
    await answerSelects.nth(i).selectOption('no')
  }
  // Диплом (веха 30%)
  await page.locator('input[type="file"]').setInputFiles({
    name: 'diploma.json', mimeType: 'application/json',
    buffer: Buffer.from('{"synthetic": true, "kind": "diploma"}')
  })
  await page.getByRole('button', { name: 'Сохранить черновик' }).click()
  await expect(page.getByText('Заполнение: 90%')).toBeVisible()
  await page.getByRole('button', { name: 'Представить сведения' }).click()
  await expect(page.getByText(/Версия \d+/).first()).toBeVisible()
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
  await expect(page.getByText('ТРЕБУЕТСЯ УТОЧНЕНИЕ').first()).toBeVisible()
  await expect(page.getByText('Уточните записи о выплатах родственникам').first()).toBeVisible()
  // Причина уточнения визуально выделена в шапке профиля
  await expect(page.getByText('Требуется уточнение.').first()).toBeVisible()
  // Резервист правит черновик и представляет новую версию
  await anketa.getByLabel('Телефон').fill('+7 900 111-11-11')
  await page.getByRole('button', { name: 'Сохранить черновик' }).click()
  await page.getByRole('button', { name: 'Представить сведения' }).click()
  await expect(page.getByText(/Изменено в версии \d+/).first()).toBeVisible()
  await expect(page.getByText('person.phone').first()).toBeVisible()
  // Проверяющий видит сравнение версий и переключается между ними
  await page.getByRole('button', { name: 'Выйти' }).click()
  await page.getByLabel('Логин').fill('reviewer')
  await page.getByLabel('Пароль').fill('resonance-demo-2026')
  await page.getByRole('button', { name: 'Войти', exact: true }).click()
  await page.getByText('Е2Е Тестовая Кандидатка').click()
  await expect(page.getByText(/Что изменилось: версия \d+ → \d+/)).toBeVisible()
  await expect(page.getByText('person.phone').first()).toBeVisible()
  await page.getByLabel('Выбор версии').selectOption({ index: 0 })
  await expect(page.getByText(/ВЕРСИЯ \d+/).first()).toBeVisible()
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
