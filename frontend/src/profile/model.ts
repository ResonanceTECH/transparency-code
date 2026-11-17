import { useEffect, useState } from 'react'
import type {
  Role,
  Screen,
  Phase,
  CandidateDetails,
  PresentedSnapshot,
  SignalDecision,
  AuditEvent,
  Entity,
  Attachment,
  Preview
} from './types'
import { documentUrl, registerFile } from './documents'
import {
  initialCandidate,
  checkCompleteness,
  documents,
  headings,
  reservistNav,
  reviewerNav,
  signalDefinitions,
  profileId
} from './data'

export function useProfileModel(initialRole: Role = 'reservist') {
  const [role, setRole] = useState<Role>(initialRole)
  const [screen, setScreen] = useState<Screen>('home')
  const [phase, setPhase] = useState<Phase>('draft')
  const [candidate, setCandidate] = useState<CandidateDetails>({ ...initialCandidate })
  const [presented, setPresented] = useState<PresentedSnapshot | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [supportFile, setSupportFile] = useState('')
  const [housingYear, setHousingYear] = useState('')
  const [housingAnswer, setHousingAnswer] = useState('Планируется')
  const [selfCheckReport, setSelfCheckReport] = useState(() => checkCompleteness('', '', 'Планируется'))
  const [activeCategory, setActiveCategory] = useState(0)
  const [categoryAnswers, setCategoryAnswers] = useState<Record<number, string>>({})
  const [relativeAnswer, setRelativeAnswer] = useState('Да')
  const [activityAnswer, setActivityAnswer] = useState('Да')
  const [consent, setConsent] = useState(false)
  const [corrected, setCorrected] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [servicePeriods, setServicePeriods] = useState<Entity[]>([])
  const [familyRecipients, setFamilyRecipients] = useState<Entity[]>([])
  const [activities, setActivities] = useState<Entity[]>([])
  const [records, setRecords] = useState<Record<number, Entity[]>>({})
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [selectedSignal, setSelectedSignal] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [question, setQuestion] = useState('')
  const [reply, setReply] = useState('')
  const [correctionChecks, setCorrectionChecks] = useState<boolean[]>([false, false, false])
  const [reviewChecks, setReviewChecks] = useState<boolean[]>([false, false, false])
  const [decisionComment, setDecisionComment] = useState('')
  const [decisionBasis, setDecisionBasis] = useState('')
  const [decisionFile, setDecisionFile] = useState('')
  const [decisionStatus, setDecisionStatus] = useState('Рассмотрение завершено')
  const [signalDecisions, setSignalDecisions] = useState<Record<number, SignalDecision>>({})
  const [query, setQuery] = useState('')
  const [queueFilter, setQueueFilter] = useState('Все')
  const [toast, setToast] = useState('')
  const [audit, setAudit] = useState<AuditEvent[]>([
    {
      time: '04.11.2026 · 12:08',
      actor: 'Резервист',
      action: 'Создан личный черновик профиля',
      scope: 'private'
    },
    {
      time: '08.11.2026 · 09:00',
      actor: 'Резервист',
      action: 'Вход в демонстрационный личный кабинет',
      scope: 'private'
    }
  ])

  // Роль приходит из API. Компонент остаётся смонтированным при смене
  // пользователя, поэтому синхронизируем роль и стартовый экран.
  useEffect(() => {
    setRole(initialRole)
    setScreen(initialRole === 'reservist' ? 'home' : 'queue')
    setMobileNav(false)
    setToast('')
  }, [initialRole])

  const completeness = checkCompleteness(supportFile, housingYear, housingAnswer)
  const ready = completeness.missing === 0
  const sent = presented !== null
  const workingVersion = corrected ? 2 : 1
  const version = role === 'reviewer' ? presented?.version || 1 : workingVersion
  const presentedCorrected = presented?.corrected || false
  const visibleCandidate = role === 'reviewer' && presented ? presented.candidate : candidate
  const privateReply = reply
  const progress = ready ? 90 : 70
  const documentCount =
    role === 'reviewer' && presented
      ? presented.documentCount
      : documents.length + (supportFile ? 1 : 0) + attachments.length
  const profileStatus =
    phase === 'completed'
      ? 'Рассмотрение завершено'
      : phase === 'removed'
        ? 'Снят с рассмотрения обоснованием'
        : phase === 'clarification'
          ? 'Требуется уточнение'
          : sent
            ? 'Сведения представлены'
            : 'Личный черновик'

  useEffect(() => {
    document.title = 'Резонанс · Финансовый профиль резервиста · макет'
  }, [])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])
  const log = (action: string, scope?: AuditEvent['scope']) =>
    setAudit((previous) => [
      ...previous,
      {
        action,
        actor: role === 'reservist' ? 'Резервист' : 'Проверяющий',
        scope: scope || (role === 'reviewer' ? 'submitted' : 'private'),
        time: '08.11.2026 · 10:42'
      }
    ])
  const navigate = (next: Screen) => {
    if (next === 'selfcheck') setSelfCheckReport(checkCompleteness(supportFile, housingYear, housingAnswer))
    setScreen(next)
    setMobileNav(false)
    setToast('')
    window.scrollTo({ top: 0, behavior: 'instant' })
    log(`Просмотр: ${headings[next][0]}`)
  }
  const showDocument = (name: string) => {
    setPreview({ name, url: documentUrl(name) })
    log(`Просмотр документа: ${name}`)
  }
  const attachSupport = (name: string, file?: File) => {
    if (file) registerFile(file)
    setSupportFile(name)
    log('Добавлен документ региональной поддержки', 'private')
    setToast('Учебный документ добавлен в макет')
  }
  const addAttachment = (name: string, file?: File) => {
    const url = file ? registerFile(file) : documentUrl(name)
    setAttachments((previous) => [...previous, { id: nextId('file'), name, url }])
    log(`Добавлен документ: ${name}`, 'private')
    setToast(`Документ «${name}» добавлен`)
  }
  const nextId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`
  const addItem = (
    list: Entity[],
    setList: (items: Entity[]) => void,
    prefix: string,
    initial: Record<string, string>
  ) => setList([...list, { id: nextId(prefix), ...initial }])
  const updateItem = (
    list: Entity[],
    setList: (items: Entity[]) => void,
    id: string,
    field: string,
    value: string
  ) => setList(list.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  const removeItem = (list: Entity[], setList: (items: Entity[]) => void, id: string) =>
    setList(list.filter((item) => item.id !== id))

  const addServicePeriod = () =>
    addItem(servicePeriods, setServicePeriods, 'period', { kind: 'военная', start: '', end: '' })
  const updateServicePeriod = (id: string, field: string, value: string) =>
    updateItem(servicePeriods, setServicePeriods, id, field, value)
  const removeServicePeriod = (id: string) => {
    removeItem(servicePeriods, setServicePeriods, id)
    log('Период службы удалён', 'private')
  }
  const addRecipient = () =>
    addItem(familyRecipients, setFamilyRecipients, 'recipient', { fullName: '', relation: '', year: '' })
  const updateRecipient = (id: string, field: string, value: string) =>
    updateItem(familyRecipients, setFamilyRecipients, id, field, value)
  const removeRecipient = (id: string) => {
    removeItem(familyRecipients, setFamilyRecipients, id)
    log('Получатель удалён', 'private')
  }
  const addActivity = () =>
    addItem(activities, setActivities, 'activity', { organization: '', kind: '', period: '' })
  const updateActivity = (id: string, field: string, value: string) =>
    updateItem(activities, setActivities, id, field, value)
  const removeActivity = (id: string) => {
    removeItem(activities, setActivities, id)
    log('Деятельность удалена', 'private')
  }
  const addRecord = (category: number) =>
    setRecords((previous) => ({
      ...previous,
      [category]: [...(previous[category] || []), { id: nextId('record'), title: '', amount: '', basis: '' }]
    }))
  const updateRecord = (category: number, id: string, field: string, value: string) =>
    setRecords((previous) => ({
      ...previous,
      [category]: (previous[category] || []).map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    }))
  const removeRecord = (category: number, id: string) => {
    setRecords((previous) => ({
      ...previous,
      [category]: (previous[category] || []).filter((item) => item.id !== id)
    }))
    log('Запись выплаты удалена', 'private')
  }
  const removeAttachment = (id: string) => {
    const item = attachments.find((file) => file.id === id)
    URL.revokeObjectURL(item?.url || '')
    setAttachments((previous) => previous.filter((file) => file.id !== id))
    log(`Документ удалён: ${item?.name || id}`, 'private')
  }
  const updateCandidate = (field: keyof CandidateDetails, value: string) => {
    setCandidate((previous) => ({ ...previous, [field]: value }))
    setConsent(false)
  }
  const repeatSelfCheck = () => {
    const report = checkCompleteness(supportFile, housingYear, housingAnswer)
    setSelfCheckReport(report)
    log(`Повторная самопроверка: ${report.completed} из 6 блоков`, 'private')
    setToast(`Самопроверка повторена: ${report.completed} из 6 блоков. Сведения и вложения сохранены.`)
  }
  const recordSignalDecision = (status: SignalDecision['status']) => {
    const comment = reviewComment.trim()
    if (comment.length < 5) return
    setSignalDecisions((previous) => ({ ...previous, [selectedSignal]: { status, comment } }))
    log(`${status}: ${signalDefinitions[selectedSignal].code}. Комментарий: ${comment}`, 'submitted')
    setReviewComment('')
    setToast('Комментарий и результат сопоставления сохранены в макете')
  }
  const submit = () => {
    if (!ready || !consent) return
    setPresented({
      version: workingVersion,
      corrected,
      candidate: { ...candidate },
      supportFile,
      housingYear,
      housingAnswer,
      documentCount,
      reply: corrected ? reply : ''
    })
    setPhase(corrected ? 'resubmitted' : 'submitted')
    setConsent(false)
    setAccepted(false)
    log(`Представлена зафиксированная версия ${workingVersion}`, 'submitted')
    log(`Доступ к версии ${workingVersion} назначен кадровому специалисту`, 'submitted')
  }
  const requestClarification = () => {
    if (reviewComment.trim().length < 5) return
    const comment = reviewComment.trim()
    setQuestion(comment)
    setPhase('clarification')
    setSignalDecisions((previous) => ({
      ...previous,
      [selectedSignal]: { status: 'Запрошено уточнение', comment }
    }))
    log(
      `Запрошено уточнение: ${signalDefinitions[selectedSignal].code}. Комментарий: ${comment}`,
      'submitted'
    )
    setReviewComment('')
    navigate('messages')
  }
  const prepareCorrection = () => {
    if (reply.trim().length < 10 || !correctionChecks.every(Boolean)) return
    setCorrected(true)
    setPhase('clarification')
    setConsent(false)
    log('Подготовлен личный черновик версии 2 с ответом на вопросы', 'private')
    navigate('selfcheck')
  }
  const complete = () => {
    if (
      !reviewChecks.every(Boolean) ||
      decisionComment.trim().length < 10 ||
      !decisionBasis.trim() ||
      !decisionFile
    )
      return
    setPhase(decisionStatus === 'Рассмотрение завершено' ? 'completed' : 'removed')
    log(`${decisionStatus}. Основание: ${decisionBasis}`, 'submitted')
  }
  const exportSummary = () => {
    const data = {
      synthetic: true,
      design_mockup: true,
      profile: profileId,
      version,
      status: profileStatus,
      basis: decisionBasis || null,
      comment: decisionComment || null
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'resonance-demo-result.json'
    anchor.click()
    URL.revokeObjectURL(url)
    log('Выгрузка учебного результата', 'submitted')
  }

  const nav = role === 'reservist' ? reservistNav : reviewerNav
  const activeNav = ['category', 'payment', 'support', 'insurance', 'housing'].includes(screen)
    ? 'payments'
    : screen
  const protectedReviewerScreen =
    role === 'reviewer' && !sent && screen !== 'queue' && screen !== 'instructions'

  return {
    role,
    screen,
    setScreen,
    phase,
    setPhase,
    candidate,
    setCandidate,
    presented,
    setPresented,
    accepted,
    setAccepted,
    supportFile,
    setSupportFile,
    housingYear,
    setHousingYear,
    housingAnswer,
    setHousingAnswer,
    selfCheckReport,
    setSelfCheckReport,
    activeCategory,
    setActiveCategory,
    categoryAnswers,
    setCategoryAnswers,
    relativeAnswer,
    setRelativeAnswer,
    activityAnswer,
    setActivityAnswer,
    consent,
    setConsent,
    corrected,
    setCorrected,
    mobileNav,
    setMobileNav,
    preview,
    setPreview,
    servicePeriods,
    familyRecipients,
    activities,
    records,
    attachments,
    selectedSignal,
    setSelectedSignal,
    reviewComment,
    setReviewComment,
    question,
    setQuestion,
    reply,
    setReply,
    correctionChecks,
    setCorrectionChecks,
    reviewChecks,
    setReviewChecks,
    decisionComment,
    setDecisionComment,
    decisionBasis,
    setDecisionBasis,
    decisionFile,
    setDecisionFile,
    decisionStatus,
    setDecisionStatus,
    signalDecisions,
    setSignalDecisions,
    query,
    setQuery,
    queueFilter,
    setQueueFilter,
    toast,
    setToast,
    audit,
    setAudit,
    completeness,
    ready,
    sent,
    workingVersion,
    version,
    presentedCorrected,
    visibleCandidate,
    privateReply,
    progress,
    documentCount,
    profileStatus,
    log,
    navigate,
    showDocument,
    attachSupport,
    addAttachment,
    removeAttachment,
    addServicePeriod,
    updateServicePeriod,
    removeServicePeriod,
    addRecipient,
    updateRecipient,
    removeRecipient,
    addActivity,
    updateActivity,
    removeActivity,
    addRecord,
    updateRecord,
    removeRecord,
    updateCandidate,
    repeatSelfCheck,
    recordSignalDecision,
    submit,
    requestClarification,
    prepareCorrection,
    complete,
    exportSummary,
    nav,
    activeNav,
    protectedReviewerScreen
  }
}

export type ProfileModel = ReturnType<typeof useProfileModel>
