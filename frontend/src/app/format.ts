import type { View, Fact } from './types'

export const labels: Record<View, string> = {
  overview: 'Обзор',
  checks: 'Все проверки',
  new: 'Новая проверка',
  case: 'Карточка проверки',
  documents: 'Документы',
  analysis: 'Результаты анализа',
  evidence: 'Карточка сигнала',
  report: 'Результат проверки',
  rules: 'Правила проверки'
}
export const statusLabels: Record<string, string> = {
  attention: 'Требует внимания',
  completed: 'Анализ завершён',
  draft: 'Ожидает анализа',
  unreviewed: 'Не рассмотрено',
  clarification: 'Запрошено уточнение',
  resolved: 'Расхождение объяснено',
  further_review: 'Дальнейшее рассмотрение'
}
export const dateText = (value: string) =>
  new Date(value.endsWith('Z') ? value : value + 'Z').toLocaleString('ru-RU', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
export const basisText = (value: string) =>
  value === 'candidate' ? 'Поступление на службу · демо' : 'Анализ представленных сведений о расходах · демо'
export const displayValue = (fact: Fact) =>
  ['RUB', 'USD', 'EUR'].includes(fact.unit) && !Number.isNaN(Number(fact.value))
    ? new Intl.NumberFormat('ru-RU', {
        style: 'currency',
        currency: fact.unit,
        maximumFractionDigits: 2
      }).format(Number(fact.value))
    : `${fact.value} ${fact.unit === 'TEXT' ? '' : fact.unit === 'M2' ? 'м²' : fact.unit}`
