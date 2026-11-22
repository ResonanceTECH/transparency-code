import { signalDefinitions } from './data'
import { activeRecords, dateText, moneyCents, optionLabel } from './fields'
import type { Entity, ProfileContent } from './types'

export type ProfileSignal = typeof signalDefinitions[number] & {
  index: number
  text: string
  leftTitle: string
  rightTitle: string
  left: string[][]
  right: string[][]
  quote: string
}

// Только введённые поля. Мы не изображаем извлечение текста из загруженного скана.
export function profileSignals(content: ProfileContent): ProfileSignal[] {
  const signals: ProfileSignal[] = []
  const relative = activeRecords(content, 4).find((row) =>
    row.recipientKind === 'Резервист за родственника' && row.basisType === 'За личное участие'
  )
  if (relative) signals.push({
    ...signalDefinitions[0], index: 0,
    text: 'В одной записи выбрана связь с родственником, но основание отмечено как личное участие. Это повод сопоставить запись с документом, а не признать нарушение.',
    leftTitle: relative.title,
    rightTitle: 'Указанная связь и документ',
    left: [['Получатель', relative.recipient], ['Сумма', `${relative.amount} ₽`], ['Основание в записи', relative.basisType],
      ['Период', `${dateText(relative.periodFrom)} — ${dateText(relative.periodTo)}`]],
    right: [['Родственник', `${content.kinship.fullName} · ${content.kinship.degree.toLowerCase()}`],
      ['Связь в анкете', optionLabel(relative.recipientKind)], ['Документ', content.attachments.find((file) => file.id === relative.documentId)?.name || 'Не приложен']],
    quote: 'Содержание загруженного файла не распознавалось. Сопоставьте выбранное основание с оригиналом документа.'
  })

  const payments = [0, 1, 2, 3, 4].flatMap((category) => activeRecords(content, category))
  const sameAssignment = (row: Entity, other: Entity) => !!row.assignmentId && row.id !== other.id
    && other.assignmentId === row.assignmentId && other.recipient === row.recipient && other.payer === row.payer
    && moneyCents(other.amount) === moneyCents(row.amount) && moneyCents(row.amount) !== null
  const duplicate = payments.find((row) => payments.some((other) => sameAssignment(row, other)))
  if (duplicate) {
    const other = payments.find((row) => sameAssignment(duplicate, row))!
    signals.push({
      ...signalDefinitions[1], index: 1,
      text: 'Совпадают получатель, сумма, плательщик и идентификатор назначения. Это возможный дубль, а не доказательство двух выплат.',
      leftTitle: duplicate.title,
      rightTitle: other.title,
      left: [['Получатель', duplicate.recipient], ['Сумма', `${duplicate.amount} ₽`], ['Назначение', duplicate.assignmentId], ['Запись', duplicate.title]],
      right: [['Получатель', other.recipient], ['Сумма', `${other.amount} ₽`], ['Назначение', other.assignmentId], ['Дата получения', dateText(other.paymentDate || '')]],
      quote: 'Совпадение полей анкеты не доказывает повторную выплату. Проверьте оба документа-основания.'
    })
  }

  if (content.activityAnswer === 'Да') for (const activity of content.activities) {
    const service = content.servicePeriods.find((period) => period.kind === 'Военная служба' && period.start && activity.periodFrom
      && period.start <= (activity.periodTo || '9999-12-31') && activity.periodFrom <= (period.end || '9999-12-31'))
    if (!service) continue
    signals.push({
      ...signalDefinitions[2], index: 2,
      text: 'Период деятельности пересекается с указанным периодом военной службы. Нужно оценить основание и применимость требования об уведомлении.',
      leftTitle: service.organization,
      rightTitle: activity.basis,
      left: [['Вид', service.kind], ['Начало', dateText(service.start)], ['Окончание', dateText(service.end)], ['Категория', service.category]],
      right: [['Организация', activity.organization], ['Оформление', activity.engagement], ['Начало', dateText(activity.periodFrom)], ['Окончание', dateText(activity.periodTo)]],
      quote: 'Периоды взяты из введённых сведений. Читаемость договора и применимость уведомления оценивает кадровый специалист.'
    })
    break
  }
  return signals
}
