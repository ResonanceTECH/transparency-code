import type { CandidateDetails, Entity, ProfileContent, Screen } from './types'

// Одни и те же поля используются в форме, проверке комплектности и печати.
export type FieldSpec = {
  key: string
  label: string
  required?: boolean
  type?: 'text' | 'date' | 'email' | 'tel' | 'year' | 'money' | 'document' | 'recipient'
  options?: string[]
  wide?: boolean
  hint?: string
}

export const personalFields: FieldSpec[] = [
  { key: 'fullName', label: 'Фамилия, имя, отчество', required: true, wide: true },
  { key: 'birthYear', label: 'Год рождения', required: true, type: 'year' },
  { key: 'workplace', label: 'Текущее место работы', required: true },
  { key: 'phone', label: 'Мобильный телефон', required: true, type: 'tel' },
  { key: 'email', label: 'Электронная почта', required: true, type: 'email' },
  { key: 'workStatus', label: 'Текущий статус работы', required: true, wide: true,
    options: ['Проходит службу', 'Работает вне государственной службы', 'Находится в запасе', 'Находится в отставке'] },
  { key: 'reportingPeriod', label: 'Период представляемых сведений', required: true },
  { key: 'appointmentAuthority', label: 'Предполагаемый орган назначения', wide: true,
    options: ['Не указан', 'ОИВ субъекта Российской Федерации', 'Федеральный орган исполнительной власти'] }
]
export const programFields: FieldSpec[] = [
  { key: 'flow', label: 'Поток программы «Время героев»', required: true },
  { key: 'programYear', label: 'Год обучения', required: true, type: 'year' },
  { key: 'region', label: 'Регион', required: true, wide: true },
  { key: 'regionalProgram', label: 'Наименование региональной программы', wide: true },
  { key: 'regionalProgramYear', label: 'Год региональной программы', type: 'year' },
  { key: 'organizer', label: 'Организатор программы', required: true },
  { key: 'diplomaDetails', label: 'Реквизиты диплома', required: true },
  { key: 'reserveActDetails', label: 'Номер и дата акта о включении в резерв', required: true },
  { key: 'diplomaDocumentId', label: 'Диплом о профессиональной переподготовке', required: true, type: 'document', wide: true },
  { key: 'reserveActDocumentId', label: 'Акт о включении в резерв', required: true, type: 'document', wide: true }
]
export const serviceFields: FieldSpec[] = [
  { key: 'kind', label: 'Вид службы', required: true, options: ['Военная служба', 'Государственная служба', 'Иное'] },
  { key: 'category', label: 'Категория офицерского состава', options: ['Не применяется', 'Младший офицерский состав', 'Старший офицерский состав', 'Высший офицерский состав', 'Волонтёр'] },
  { key: 'organization', label: 'Организация / место службы', required: true, wide: true },
  { key: 'start', label: 'Начало', required: true, type: 'date' },
  { key: 'end', label: 'Окончание', type: 'date', hint: 'Оставьте пустым, если период продолжается' }
]
export const kinshipFields: FieldSpec[] = [
  { key: 'fullName', label: 'ФИО родственника', required: true, wide: true },
  { key: 'degree', label: 'Степень родства', required: true, options: ['Супруг', 'Ребёнок', 'Родитель', 'Иная степень родства'] },
  { key: 'status', label: 'Статус родственника', required: true, options: ['Участвует', 'Участвовал', 'Погиб', 'Пропал без вести'] }
]
export const recipientFields: FieldSpec[] = [
  { key: 'fullName', label: 'ФИО получателя', required: true, wide: true },
  { key: 'relation', label: 'Связь с кандидатом', required: true },
  { key: 'year', label: 'Год рождения получателя', required: true, type: 'year' }
]
export const activityFields: FieldSpec[] = [
  { key: 'organization', label: 'Организация', required: true, wide: true },
  { key: 'kind', label: 'Вид деятельности', required: true, options: ['Преподавание', 'Экспертиза', 'Консультирование', 'Участие в комиссии', 'Иное'] },
  { key: 'engagement', label: 'Вид оформления', required: true, options: ['Трудовой договор', 'Срочный трудовой договор', 'Совместительство', 'Гражданско-правовой договор', 'Безвозмездная деятельность'] },
  { key: 'periodFrom', label: 'Начало периода', required: true, type: 'date' },
  { key: 'periodTo', label: 'Окончание периода', type: 'date' },
  { key: 'basis', label: 'Наименование и реквизиты основания', required: true, wide: true },
  { key: 'documentId', label: 'Документ деятельности', required: true, type: 'document', wide: true }
]

const title: FieldSpec = { key: 'title', label: 'Наименование выплаты', required: true, wide: true }
const recipient: FieldSpec = { key: 'recipient', label: 'Получатель', required: true }
const amount: FieldSpec = { key: 'amount', label: 'Сумма, ₽', required: true, type: 'money' }
const basis: FieldSpec = { key: 'basis', label: 'Основание', required: true, wide: true }
const period: FieldSpec[] = [
  { key: 'periodFrom', label: 'Период основания: начало', required: true, type: 'date' },
  { key: 'periodTo', label: 'Период основания: окончание', required: true, type: 'date' }
]
const paymentDate: FieldSpec = { key: 'paymentDate', label: 'Дата фактического перечисления', required: true, type: 'date' }
const payer: FieldSpec = { key: 'payer', label: 'Плательщик (часть, ведомство)', required: true }
const document: FieldSpec = { key: 'documentId', label: 'Документ-основание', required: true, type: 'document', wide: true }

export function paymentFields(category: number, record: Entity, content: ProfileContent): FieldSpec[] {
  switch (category) {
    case 0: return [title, ...period, payer, recipient, amount, basis, document]
    case 1: return [{ ...title, label: 'Вид надбавки' }, { ...basis, label: 'Основание надбавки' }, ...period, payer, recipient, amount,
      { key: 'assignmentId', label: 'Идентификатор назначения' }, document]
    case 2: return [title, { key: 'eventKind', label: 'Вид события', required: true },
      { key: 'eventDate', label: 'Дата события', type: 'date', required: true },
      { key: 'recipientKind', label: 'Категория получателя', required: true, options: ['Сам резервист', 'Член семьи', 'Резервист за родственника'] },
      recipient, amount, payer, { ...basis, label: 'Нормативное основание и редакция' }, ...period, paymentDate,
      { key: 'assignmentId', label: 'Идентификатор назначения', hint: 'Для сопоставления возможных дублей' },
      { ...document, required: false, hint: 'При наличии: отсутствие файла не блокирует отправку' }]
    case 3: return [{ key: 'level', label: 'Уровень поддержки', required: true, options: ['Федеральный', 'Региональный', 'Муниципальный'] },
      { key: 'authority', label: 'Регион / орган назначения', required: true }, { ...title, label: 'Наименование меры' },
      { key: 'code', label: 'Код меры' }, { ...paymentDate, label: 'Дата выплаты' }, recipient, amount, basis, document]
    case 4: return [title,
      { key: 'recipientKind', label: 'Связь выплаты с получателем', required: true, options: ['Сам резервист', 'Резервист за родственника'] },
      recipient, { key: 'basisType', label: 'Основание в представленной записи', required: true, options: ['За личное участие', 'В связи с родственником'] },
      basis, paymentDate, ...period, amount, document]
    case 5: return [] // Только ответ. Никаких справок и обязательных денежных полей.
    case 6: return [{ ...title, label: 'Наименование выплаты члену семьи' },
      { key: 'recipientId', label: 'Получатель — член семьи', type: 'recipient', required: true },
      amount, basis, paymentDate, document]
    case 7: return [{ ...title, label: 'Назначение помощи' },
      { key: 'form', label: 'Форма помощи', required: true, options: ['Денежная', 'Натуральная'] },
      { key: 'organization', label: 'Организация или фонд', required: true }, recipient,
      ...(record.form === 'Денежная' ? [amount] : [{ key: 'description', label: 'Предоставленная мера', required: true, wide: true } as FieldSpec]),
      basis, document]
    case 8: return content.categoryAnswers[8] === 'Планируется'
      ? [{ key: 'expectedYear', label: 'Предполагаемый год приобретения', required: true, type: 'year' },
        { key: 'title', label: 'Статус меры', required: true }, { ...basis, label: 'Документальное основание' }, document]
      : [{ key: 'housingKind', label: 'Вид меры', required: true, options: ['Субсидия', 'Компенсация', 'Предоставление жилья', 'Кредит · учитывается отдельно'] },
        { ...basis, label: 'Основание назначения' }, { key: 'decisionDate', label: 'Дата решения', required: true, type: 'date' },
        { key: 'acquisitionDate', label: 'Дата приобретения', required: true, type: 'date' }, document]
    case 9: return [{ key: 'description', label: 'Описание меры', required: true, wide: true }, basis, document]
    default: return []
  }
}

export function activeRecords(content: ProfileContent, category: number): Entity[] {
  if (!content.categoryAnswers[category] || content.categoryAnswers[category] === 'Нет' || category === 5) return []
  return (content.records[category] || []).filter((record) => {
    if (category === 3) return content.supportLevels[record.level] === 'Да'
    if (category === 4) return record.recipientKind === 'Резервист за родственника'
      ? content.relativeAnswer === 'Да' && content.kinship.receivedPayments === 'Да'
      : content.personalInsuranceAnswer === 'Да'
    return true
  })
}

export function moneyCents(value: string): number | null {
  const normalized = value.replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}
export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(cents / 100).replace(/\u00a0/g, ' ')
}
export function dateText(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split('-').reverse().join('.') : value
}

export function fieldError(spec: FieldSpec, value: string, content: ProfileContent, record?: Record<string, string>): string | undefined {
  if (!value?.trim()) return spec.required ? `Заполните поле «${spec.label}»` : undefined
  if (spec.options && !spec.options.includes(value)) return 'Выберите значение из списка'
  if (spec.type === 'document') {
    if (!content.attachments.some((file) => file.id === value && file.kind === 'basis')) return 'Прикрепите документ-основание'
  }
  if (spec.type === 'recipient' && !content.familyRecipients.some((person) => person.id === value)) return 'Добавьте и выберите получателя'
  if (spec.type === 'year' && !/^(19|20)\d{2}$/.test(value)) return 'Укажите год из четырёх цифр'
  if (spec.key === 'expectedYear' && !/^20\d{2}$/.test(value)) return 'Укажите предполагаемый год, например 2028'
  if (spec.type === 'money' && moneyCents(value) === null) return 'Укажите неотрицательную сумму, не более двух знаков после запятой'
  if (spec.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Проверьте адрес электронной почты'
  if (spec.type === 'date') {
    const parsed = new Date(value + 'T00:00:00Z')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return 'Укажите корректную дату'
    const start = spec.key === 'end' ? record?.start : spec.key === 'periodTo' ? record?.periodFrom : ''
    if (start && value < start) return 'Окончание не может быть раньше начала периода'
  }
  return undefined
}

export function assessContent(content: ProfileContent) {
  const errors = (fields: FieldSpec[], row: Record<string, string>) => fields.flatMap((field) => {
    const message = fieldError(field, row[field.key] || '', content, row)
    return message ? [message] : []
  })
  const personal = errors(personalFields, content.candidate as unknown as Record<string, string>)
  const program = errors(programFields, content.candidate as unknown as Record<string, string>)
  const programIdentity = errors(programFields.filter((field) =>
    !['diplomaDetails', 'reserveActDetails', 'diplomaDocumentId', 'reserveActDocumentId'].includes(field.key)
  ), content.candidate as unknown as Record<string, string>)
  const servicePeriods = content.servicePeriods.length ? content.servicePeriods.flatMap((row) => errors(serviceFields.map((f) =>
    f.key === 'category' ? { ...f, required: row.kind === 'Военная служба' } : f), row)) : ['Добавьте хотя бы один период службы или работы']
  const service = [...servicePeriods]
  if (content.relativeAnswer === 'Да') service.push(...errors(kinshipFields, content.kinship))
  if (!['Да', 'Нет'].includes(content.relativeAnswer)) service.push('Ответьте на вопрос о родстве')
  if (content.relativeAnswer === 'Да' && !['Да', 'Нет'].includes(content.kinship.receivedPayments)) service.push('Ответьте на вопрос о выплатах за родственника')
  if (content.categoryAnswers[6] === 'Да') {
    if (!content.familyRecipients.length) service.push('Добавьте получателя — члена семьи')
    service.push(...content.familyRecipients.flatMap((row) => errors(recipientFields, row)))
  }
  const answers = Object.keys(content.categoryAnswers).filter((key) => ['Да', 'Нет', ...(Number(key) === 8 ? ['Планируется'] : [])].includes(content.categoryAnswers[Number(key)])).length
  const answerErrors = answers === 10 ? [] : ['Дайте ответ по всем десяти категориям выплат']
  if (Object.values(content.supportLevels).some((answer) => !['Да', 'Нет'].includes(answer))) answerErrors.push('Ответьте по каждому уровню поддержки')
  if (!['Да', 'Нет'].includes(content.personalInsuranceAnswer)) answerErrors.push('Ответьте на вопрос о личных страховых выплатах')
  const categoryIssues = (category: number) => {
    if (content.categoryAnswers[category] === 'Нет' || category === 5) return []
    const rows = activeRecords(content, category)
    const issues = rows.length ? rows.flatMap((row) => errors(paymentFields(category, row, content), row)) : ['Добавьте запись или ответьте «Нет»']
    if (category === 3) for (const [level, answer] of Object.entries(content.supportLevels)) {
      if (answer === 'Да' && !rows.some((row) => row.level === level)) issues.push(`Добавьте сведения: ${level.toLowerCase()} уровень поддержки`)
    }
    if (category === 4) {
      if (content.personalInsuranceAnswer === 'Да' && !rows.some((row) => row.recipientKind === 'Сам резервист')) {
        issues.push('Добавьте запись личной страховой выплаты или ответьте «Нет»')
      }
      if (content.relativeAnswer === 'Да' && content.kinship.receivedPayments === 'Да'
        && !rows.some((row) => row.recipientKind === 'Резервист за родственника')) {
        issues.push('Добавьте запись выплаты за родственника или ответьте «Нет»')
      }
    }
    return issues
  }
  const payments = [0, 1, 2, 4, 6, 7, 9].flatMap(categoryIssues)
  const support = categoryIssues(3)
  const housing = categoryIssues(8)
  const activity = content.activityAnswer === 'Нет' ? [] : content.activityAnswer !== 'Да' ? ['Ответьте на вопрос о деятельности']
    : content.activities.length ? content.activities.flatMap((row) => errors(activityFields, row)) : ['Добавьте деятельность или ответьте «Нет»']
  const consent = content.attachments.some((file) => file.id === content.consentDocumentId && file.kind === 'consent')
    ? [] : ['Прикрепите подписанный скан согласия на обработку персональных данных']
  const rows: { title: string; screen: Screen; issues: string[] }[] = [
    { title: 'Личность, программа и включение в резерв', screen: 'profile', issues: [...personal, ...program] },
    { title: 'Служба, родство и получатели', screen: servicePeriods.length ? 'profile' : 'kinship', issues: service },
    { title: 'Ответы и записи по категориям', screen: 'payments', issues: [...answerErrors, ...payments] },
    { title: 'Основания мер поддержки', screen: 'support', issues: support },
    { title: 'Жилищная мера', screen: 'housing', issues: housing },
    { title: 'Дополнительная деятельность', screen: 'activities', issues: activity },
    { title: 'Подписанное согласие на обработку ПДн', screen: 'documents', issues: consent }
  ]
  const completed = rows.filter((row) => !row.issues.length).length
  const missing = rows.length - completed
  let progress = 0
  if (!personal.length && !programIdentity.length) {
    progress = 10
    if (!program.length) {
      progress = 30
      if (!service.length) {
        progress = 50
        if (!answerErrors.length) progress = missing ? 70 : 90
      }
    }
  }
  return { rows, completed, missing, progress, answers, categoryIssues, support: !support.length, housing: !housing.length }
}

export function financialSummary(content: ProfileContent) {
  let personal = 0, family = 0, personalRecords = 0
  for (let category = 0; category < 10; category++) for (const row of activeRecords(content, category)) {
    if ([5, 8, 9].includes(category) || row.form === 'Натуральная') continue
    const cents = moneyCents(row.amount || '')
    if (cents === null) continue
    if (category === 6 || row.recipientKind === 'Член семьи') family += cents
    else { personal += cents; personalRecords++ }
  }
  return { personal: formatMoney(personal), family: formatMoney(family), personalRecords }
}

export function fieldText(spec: FieldSpec, row: Record<string, string> | CandidateDetails, content: ProfileContent): string {
  const value = (row as Record<string, string>)[spec.key] || ''
  if (spec.type === 'document') return content.attachments.find((file) => file.id === value)?.name || (spec.required ? 'НЕ ПРИКРЕПЛЁН' : 'При наличии · не прикреплён')
  if (spec.type === 'recipient') {
    const person = content.familyRecipients.find((item) => item.id === value)
    return person ? `${person.fullName}; ${person.relation}; ${person.year} г. р.` : 'НЕ УКАЗАН'
  }
  if (!value) return spec.required ? 'НЕ ЗАПОЛНЕНО' : spec.type === 'date' ? 'Не указано / период продолжается' : 'Не указано (необязательно)'
  return spec.type === 'date' ? dateText(value) : value
}
