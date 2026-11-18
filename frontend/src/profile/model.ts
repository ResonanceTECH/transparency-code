import { useEffect, useRef, useState } from 'react'
import type {
  Role, Screen, Phase, CandidateDetails, PresentedSnapshot, ProfileContent, SignalDecision,
  AuditEvent, Entity, Attachment, Preview, DocumentAssessment
} from './types'
import { uploadedAttachment, sampleAttachment, CONSENT_SAMPLE, SUPPORT_SAMPLE } from './documents'
import { createInitialContent, headings, reservistNav, reviewerNav, profileId, categoryDefinitions } from './data'
import { activeRecords, assessContent, financialSummary, paymentFields } from './fields'
import { profileSignals } from './signals'

const now = () => new Date().toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
const nextId = () => crypto.randomUUID()
const copy = <T,>(value: T): T => structuredClone(value)

export function useProfileModel(role: Role = 'reservist', actorName = '') {
  const [screen, setScreen] = useState<Screen>(role === 'reservist' ? 'home' : 'queue')
  const [phase, setPhase] = useState<Phase>('draft')
  const [draft, setDraft] = useState<ProfileContent>(createInitialContent)
  const [versions, setVersions] = useState<PresentedSnapshot[]>([])
  const [accepted, setAccepted] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)
  const [consent, setConsent] = useState(false)
  const [corrected, setCorrected] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [selectedSignal, setSelectedSignal] = useState(0)
  const [selectedSignalVersion, setSelectedSignalVersion] = useState<number | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [question, setQuestion] = useState('')
  const [questionAuthor, setQuestionAuthor] = useState('')
  const [reply, setReply] = useState('')
  const [reviewChecks, setReviewChecks] = useState<boolean[]>([false, false, false])
  const [decisionComment, setDecisionComment] = useState('')
  const [decisionBasis, setDecisionBasis] = useState('')
  const [decisionDocument, setDecisionDocument] = useState<Attachment | null>(null)
  const [decisionStatus, setDecisionStatus] = useState('Рассмотрение завершено')
  const [decisionAuthor, setDecisionAuthor] = useState('')
  const [signalDecisions, setSignalDecisions] = useState<Record<string, SignalDecision>>({})
  const [documentAssessments, setDocumentAssessments] = useState<Record<string, DocumentAssessment>>({})
  const [selectedDocument, setSelectedDocument] = useState('sample-diploma')
  const [documentComment, setDocumentComment] = useState('')
  const [documentStatus, setDocumentStatus] = useState<DocumentAssessment['status']>('Пригоден для сопоставления')
  const [query, setQuery] = useState('')
  const [queueFilter, setQueueFilter] = useState('Все')
  const [toast, setToast] = useState('')
  const [printSource, setPrintSource] = useState<'draft' | 'submitted'>(role === 'reservist' ? 'draft' : 'submitted')
  const [templateId, setTemplateId] = useState('profile')
  const [audit, setAudit] = useState<AuditEvent[]>([
    { time: '04.11.2026 · 12:08', actor: 'Резервист', role: 'reservist', action: 'Создан личный черновик профиля', scope: 'private' }
  ])
  // URL живёт до закрытия сценария: удаление/замена в черновике не ломает файл старой версии.
  const ownedUrls = useRef(new Set<string>())
  useEffect(() => () => { ownedUrls.current.forEach((url) => URL.revokeObjectURL(url)) }, [])

  const presented = versions.at(-1) || null
  const sent = presented !== null
  const reviewerClosed = phase === 'completed' || phase === 'removed'
  const completeness = assessContent(draft)
  const ready = completeness.missing === 0
  const workingVersion = (presented?.version || 0) + 1
  const visibleContent = role === 'reviewer' && presented ? presented : draft
  const visibleCandidate = visibleContent.candidate
  const visibleAttachments = visibleContent.attachments
  const documentCount = visibleAttachments.length
  const housingAnswer = draft.categoryAnswers[8]
  const consentDocument = draft.attachments.find((file) => file.id === draft.consentDocumentId) || null
  const presentedCorrected = presented?.corrected || false
  const profileStatus = phase === 'completed' ? 'Рассмотрение завершено'
    : phase === 'removed' ? 'Снят с рассмотрения обоснованием'
      : phase === 'clarification' ? 'Требуется уточнение'
        : accepted ? 'Принят к рассмотрению' : sent ? 'Сведения представлены' : 'Личный черновик'
  const summary = financialSummary(visibleContent)
  const recordCount = Array.from({ length: 10 }, (_, category) => activeRecords(visibleContent, category).length).reduce((a, b) => a + b, 0)
  const signalSource = versions.find((item) => item.version === selectedSignalVersion) || presented || draft
  const signals = profileSignals(signalSource)
  const signalVersion = 'version' in signalSource ? Number(signalSource.version) : 1
  const historicalSignals = !!presented && signalVersion !== presented.version
  const signalReadOnly = reviewerClosed || historicalSignals
  const currentSignals = profileSignals(presented || draft)
  const signalDecision = (code: string, version = signalVersion) => signalDecisions[`${version}:${code}`]
  const reviewedSignals = (version = signalVersion) => Object.values(signalDecisions).filter((decision) =>
    decision.version === version && ['Рассмотрено', 'Исключено с обоснованием'].includes(decision.status)
  ).length
  const hasDraftChanges = !!presented && JSON.stringify(draft) !== JSON.stringify({
    candidate: presented.candidate, servicePeriods: presented.servicePeriods, relativeAnswer: presented.relativeAnswer,
    kinship: presented.kinship, familyRecipients: presented.familyRecipients, categoryAnswers: presented.categoryAnswers,
    supportLevels: presented.supportLevels, personalInsuranceAnswer: presented.personalInsuranceAnswer,
    records: presented.records, activityAnswer: presented.activityAnswer, activities: presented.activities,
    attachments: presented.attachments, consentDocumentId: presented.consentDocumentId, photo: presented.photo
  })

  useEffect(() => {
    setScreen(role === 'reservist' ? 'home' : 'queue')
    setMobileNav(false)
    setPreview(null)
    setToast('')
    setPrintSource(role === 'reservist' ? 'draft' : 'submitted')
    if (actorName) setAudit((previous) => [...previous, {
      time: now(), actor: actorName || (role === 'reservist' ? 'Резервист' : 'Проверяющий'), role,
      action: 'Вход в учебный кабинет', scope: role === 'reservist' ? 'private' : 'submitted'
    }])
  }, [role, actorName])
  useEffect(() => {
    document.title = screen === 'print' ? `Резонанс · анкета ${profileId}` : 'Резонанс · Финансовый профиль резервиста · макет'
  }, [screen])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const log = (action: string, scope?: AuditEvent['scope']) => setAudit((previous) => [...previous, {
    action, actor: actorName || (role === 'reservist' ? 'Резервист' : 'Проверяющий'), role,
    scope: scope || (role === 'reviewer' ? 'submitted' : 'private'), time: now()
  }])
  const navigate = (next: Screen) => {
    if (next === 'print') setPrintSource(role === 'reservist' && !reviewerClosed ? 'draft' : 'submitted')
    setScreen(next)
    setMobileNav(false)
    setPreview(null)
    setToast('')
    window.scrollTo({ top: 0, behavior: 'instant' })
    log(`Просмотр: ${headings[next][0]}`)
  }
  const changeDraft = (change: (content: ProfileContent) => ProfileContent) => {
    if (role !== 'reservist' || reviewerClosed) return
    setDraft(change)
    setConsent(false)
  }
  const updateCandidate = (field: keyof CandidateDetails, value: string) => changeDraft((previous) => ({
    ...previous, candidate: { ...previous.candidate, [field]: value }
  }))
  const updateList = (list: 'servicePeriods' | 'familyRecipients' | 'activities', id: string, field: string, value: string) =>
    changeDraft((previous) => ({ ...previous, [list]: previous[list].map((item) => item.id === id ? { ...item, [field]: value } : item) }))
  const removeListItem = (list: 'servicePeriods' | 'familyRecipients' | 'activities', id: string) => {
    changeDraft((previous) => ({ ...previous, [list]: previous[list].filter((item) => item.id !== id) }))
    log('Удалена запись личного черновика', 'private')
  }
  const addServicePeriod = () => changeDraft((previous) => ({ ...previous, servicePeriods: [...previous.servicePeriods,
    { id: nextId(), kind: 'Военная служба', category: 'Младший офицерский состав', organization: '', start: '', end: '' }] }))
  const addRecipient = () => changeDraft((previous) => ({ ...previous, familyRecipients: [...previous.familyRecipients,
    { id: nextId(), fullName: '', relation: '', year: '' }] }))
  const addActivity = () => changeDraft((previous) => ({ ...previous, activities: [...previous.activities,
    { id: nextId(), organization: '', kind: 'Преподавание', engagement: 'Гражданско-правовой договор', periodFrom: '', periodTo: '', basis: '', documentId: '' }] }))

  const insuranceAnswer = (content: ProfileContent) => content.personalInsuranceAnswer === 'Да'
    || (content.relativeAnswer === 'Да' && content.kinship.receivedPayments === 'Да') ? 'Да' : 'Нет'
  const setRelativeAnswer = (answer: string) => changeDraft((previous) => {
    const next = { ...previous, relativeAnswer: answer }
    return { ...next, categoryAnswers: { ...next.categoryAnswers, 4: insuranceAnswer(next) } }
  })
  const updateKinship = (field: keyof ProfileContent['kinship'], value: string) => changeDraft((previous) => {
    const next = { ...previous, kinship: { ...previous.kinship, [field]: value } }
    return { ...next, categoryAnswers: { ...next.categoryAnswers, 4: insuranceAnswer(next) } }
  })
  const setPersonalInsuranceAnswer = (value: string) => changeDraft((previous) => {
    const next = { ...previous, personalInsuranceAnswer: value }
    return { ...next, categoryAnswers: { ...next.categoryAnswers, 4: insuranceAnswer(next) } }
  })
  const setSupportLevel = (level: string, value: string) => changeDraft((previous) => {
    const levels = { ...previous.supportLevels, [level]: value }
    return { ...previous, supportLevels: levels, categoryAnswers: { ...previous.categoryAnswers, 3: Object.values(levels).includes('Да') ? 'Да' : 'Нет' } }
  })
  const setCategoryAnswer = (category: number, value: string) => changeDraft((previous) => ({
    ...previous, categoryAnswers: { ...previous.categoryAnswers, [category]: value }
  }))
  const setActivityAnswer = (value: string) => changeDraft((previous) => ({ ...previous, activityAnswer: value }))
  const addRecord = (category: number, recipientKind = 'Сам резервист') => changeDraft((previous) => {
    const row: Entity = { id: nextId(), title: '', amount: '', basis: '', documentId: '', recipient: previous.candidate.fullName,
      recipientKind, recipientId: previous.familyRecipients[0]?.id || '', form: 'Денежная',
      level: Object.entries(previous.supportLevels).find(([, answer]) => answer === 'Да')?.[0] || 'Региональный',
      basisType: recipientKind === 'Резервист за родственника' ? 'В связи с родственником' : 'За личное участие' }
    for (const field of paymentFields(category, row, previous)) if (!(field.key in row)) row[field.key] = field.options?.[0] || ''
    return { ...previous, records: { ...previous.records, [category]: [...(previous.records[category] || []), row] } }
  })
  const updateRecord = (category: number, id: string, field: string, value: string) => changeDraft((previous) => ({
    ...previous, records: { ...previous.records, [category]: (previous.records[category] || []).map((row) => row.id === id ? { ...row, [field]: value } : row) }
  }))
  const removeRecord = (category: number, id: string) => {
    changeDraft((previous) => ({ ...previous, records: { ...previous.records, [category]: (previous.records[category] || []).filter((row) => row.id !== id) } }))
    log('Запись выплаты удалена из черновика', 'private')
  }

  const makeAttachment = (name: string, file: File | undefined, section: string, kind: Attachment['kind'] = 'basis') => {
    const attachment = file ? uploadedAttachment(file, section, kind) : sampleAttachment(name, section, kind)
    if (file) ownedUrls.current.add(attachment.url)
    return attachment
  }
  const addAttachment = (name: string, file?: File) => {
    const attachment = makeAttachment(name, file, 'Дополнительный документ')
    changeDraft((previous) => ({ ...previous, attachments: [...previous.attachments, attachment] }))
    log(`Загружен документ: ${name}`, 'private')
  }
  const attachRecordDocument = (category: number, id: string, name: string, file?: File) => {
    const attachment = makeAttachment(name, file, categoryDefinitions[category].title)
    changeDraft((previous) => ({ ...previous, attachments: [...previous.attachments, attachment],
      records: { ...previous.records, [category]: previous.records[category].map((row) => row.id === id ? { ...row, documentId: attachment.id } : row) } }))
    log(`Загружено основание: ${name}`, 'private')
  }
  const attachProfileDocument = (field: 'diplomaDocumentId' | 'reserveActDocumentId', name: string, file?: File) => {
    const attachment = makeAttachment(name, file, field === 'diplomaDocumentId' ? 'Программа «Время героев»' : 'Акт о включении в резерв')
    changeDraft((previous) => ({ ...previous, attachments: [...previous.attachments, attachment], candidate: { ...previous.candidate, [field]: attachment.id } }))
    log(`Загружен документ профиля: ${name}`, 'private')
  }
  const attachActivityDocument = (id: string, name: string, file?: File) => {
    const attachment = makeAttachment(name, file, 'Дополнительная деятельность')
    changeDraft((previous) => ({ ...previous, attachments: [...previous.attachments, attachment],
      activities: previous.activities.map((row) => row.id === id ? { ...row, documentId: attachment.id } : row) }))
    log(`Загружен документ деятельности: ${name}`, 'private')
  }
  const attachConsent = (name: string, file?: File) => {
    const attachment = makeAttachment(name, file, 'Согласие на обработку персональных данных', 'consent')
    changeDraft((previous) => ({ ...previous, attachments: [...previous.attachments, attachment], consentDocumentId: attachment.id }))
    log(`Загружен скан согласия: ${name}. Подпись требует ручной проверки`, 'private')
  }
  const removeAttachment = (id: string) => {
    changeDraft((previous) => ({ ...previous, attachments: previous.attachments.filter((file) => file.id !== id),
      consentDocumentId: previous.consentDocumentId === id ? '' : previous.consentDocumentId,
      candidate: { ...previous.candidate,
        diplomaDocumentId: previous.candidate.diplomaDocumentId === id ? '' : previous.candidate.diplomaDocumentId,
        reserveActDocumentId: previous.candidate.reserveActDocumentId === id ? '' : previous.candidate.reserveActDocumentId },
      records: Object.fromEntries(Object.entries(previous.records).map(([category, rows]) =>
        [category, rows.map((row) => row.documentId === id ? { ...row, documentId: '' } : row)])),
      activities: previous.activities.map((row) => row.documentId === id ? { ...row, documentId: '' } : row)
    }))
    log('Документ удалён из черновика; представленные версии сохранены', 'private')
  }
  const attachPhoto = (file: File) => {
    const photo = makeAttachment(file.name, file, 'Фото для карточки', 'photo')
    changeDraft((previous) => ({ ...previous, photo }))
    log('Обновлено необязательное фото для карточки', 'private')
  }
  const showDocument = (name: string, url?: string) => {
    const actualUrl = url || visibleAttachments.find((file) => file.name === name)?.url
      || (decisionDocument?.name === name ? decisionDocument.url : '')
    if (!actualUrl) { setToast('Документ не найден в доступной версии'); return }
    setPreview({ name, url: actualUrl })
    log(`Просмотр документа: ${name}`)
  }
  const recordDownload = (name: string) => log(`Выгрузка документа: ${name}`)
  const attachDecision = (name: string, file?: File) => {
    if (role !== 'reviewer' || !sent || reviewerClosed) return
    setDecisionDocument(makeAttachment(name, file, 'Основание результата', 'result'))
    log(`Загружено основание результата: ${name}`, 'submitted')
  }
  const repeatSelfCheck = () => {
    log(`Повторная самопроверка: ${completeness.completed} из 7 блоков`, 'private')
    setToast(`Самопроверка повторена: ${completeness.completed} из 7 блоков. Сведения и вложения сохранены.`)
  }

  const snapshot = (content: ProfileContent, demo = false): PresentedSnapshot => ({
    ...copy(content), version: workingVersion, corrected: !demo && corrected, createdAt: now(), demo,
    transferConfirmedAt: now(),
    documentCount: content.attachments.length, reply: demo ? '' : reply
  })
  const submit = () => {
    if (role !== 'reservist' || !ready || !consent || reviewerClosed || (sent && phase !== 'clarification')) return
    setVersions((previous) => [...previous, snapshot(draft)])
    setPhase(sent ? 'resubmitted' : 'submitted')
    setConsent(false)
    setAccepted(false)
    setSelectedSignalVersion(null)
    setReviewChecks([false, false, false])
    setDecisionComment('')
    setDecisionBasis('')
    setDecisionDocument(null)
    setDocumentComment('')
    log(`Представлена зафиксированная версия ${workingVersion}; подтверждение передачи сохранено`, 'submitted')
    log(`Доступ к версии ${workingVersion} назначен кадровому специалисту`, 'submitted')
  }
  const loadDemoMaterial = () => {
    if (role !== 'reviewer' || sent) return
    // Отдельный готовый комплект, а НЕ текущий приватный черновик.
    const content = createInitialContent()
    const support = sampleAttachment(SUPPORT_SAMPLE, 'Региональная поддержка')
    const scan = sampleAttachment(CONSENT_SAMPLE, 'Учебное согласие на обработку ПДн', 'consent')
    content.attachments.push(support, scan)
    content.records[3][0].documentId = support.id
    content.records[8][0].expectedYear = '2028'
    content.consentDocumentId = scan.id
    setVersions([snapshot(content, true)])
    setPhase('submitted')
    setAccepted(false)
    log('Загружен готовый учебный комплект и назначен доступ. Приватный черновик не использован', 'submitted')
  }
  const recordSignalDecision = (status: SignalDecision['status']) => {
    const signal = signals.find((item) => item.index === selectedSignal) || signals[0]
    if (role !== 'reviewer' || !sent || signalReadOnly || !signal || reviewComment.trim().length < 5) return
    const comment = reviewComment.trim()
    setSignalDecisions((previous) => ({ ...previous, [`${signalVersion}:${signal.code}`]: {
      version: signalVersion, code: signal.code, status, comment, author: actorName || 'Проверяющий', time: now()
    } }))
    log(`${status}: ${signal.code}, версия ${signalVersion}. Комментарий: ${comment}`, 'submitted')
    setReviewComment('')
  }
  const clarify = (comment: string) => {
    if (role !== 'reviewer' || !sent || reviewerClosed || comment.trim().length < 5) return
    setQuestion(comment.trim())
    setQuestionAuthor(actorName || 'Проверяющий')
    setPhase('clarification')
    log(`Требуются уточнения. Комментарий: ${comment.trim()}`, 'submitted')
  }
  const requestClarification = () => {
    if (reviewComment.trim().length < 5 || signalReadOnly) return
    recordSignalDecision('Запрошено уточнение')
    clarify(reviewComment)
    navigate('messages')
  }
  const prepareCorrection = () => {
    if (role !== 'reservist' || phase !== 'clarification' || reply.trim().length < 10) return
    setCorrected(true)
    setConsent(false)
    log('Подготовлена новая версия с пояснением. Данные и файлы изменяет сам резервист', 'private')
    navigate('selfcheck')
  }
  const finalDecision = ['Рассмотрение завершено', 'Снят с рассмотрения обоснованием'].includes(decisionStatus)
  const canDecide = sent && !reviewerClosed && decisionComment.trim().length >= (finalDecision ? 10 : 5)
    && (!finalDecision || (reviewChecks.every(Boolean) && !!decisionBasis.trim() && !!decisionDocument))
  const complete = () => {
    if (role !== 'reviewer' || !canDecide) return
    setDecisionAuthor(actorName || 'Проверяющий')
    if (decisionStatus === 'Принят к рассмотрению') {
      setAccepted(true)
      setPhase(presented && presented.version > 1 ? 'resubmitted' : 'submitted')
    }
    else if (decisionStatus === 'Требуются уточнения') clarify(decisionComment)
    else setPhase(decisionStatus === 'Рассмотрение завершено' ? 'completed' : 'removed')
    log(`${decisionStatus}. Основание: ${decisionBasis || 'рабочий статус'}. Комментарий: ${decisionComment}`, 'submitted')
  }
  const chooseDocument = (id: string) => {
    setSelectedDocument(id)
    setDocumentComment('')
    setDocumentStatus('Пригоден для сопоставления')
  }
  const assessDocument = () => {
    if (role !== 'reviewer' || !presented || reviewerClosed || documentComment.trim().length < 5
      || !presented.attachments.some((file) => file.id === selectedDocument)) return
    const assessment: DocumentAssessment = { documentId: selectedDocument, version: presented.version,
      status: documentStatus, comment: documentComment.trim(), author: actorName || 'Проверяющий', time: now() }
    setDocumentAssessments((previous) => ({ ...previous, [`${presented.version}:${selectedDocument}`]: assessment }))
    log(`Оценка документа версии ${presented.version}: ${presented.attachments.find((file) => file.id === selectedDocument)?.name}. ${documentStatus}. Комментарий: ${assessment.comment}`, 'submitted')
  }
  const clarifyDocument = () => {
    const file = presented?.attachments.find((item) => item.id === selectedDocument)
    if (!file || documentComment.trim().length < 5 || reviewerClosed) return
    assessDocument()
    clarify(`Документ «${file.name}»: ${documentComment.trim()}`)
    navigate('messages')
  }
  const exportSummary = () => {
    if (role !== 'reviewer' || !presented) return
    const result = { synthetic: true, design_mockup: true, profile: profileId, version: presented,
      status: profileStatus, basis: reviewerClosed ? decisionBasis : null, comment: reviewerClosed ? decisionComment : null,
      document_assessments: Object.values(documentAssessments).filter((item) => item.version === presented.version) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'resonance-demo-result.json'
    anchor.click()
    URL.revokeObjectURL(url)
    log('Выгрузка учебного результата и представленной анкеты', 'submitted')
  }
  const printDraft = role === 'reservist' && printSource === 'draft'
  const printContent = printDraft ? draft : presented
  const printProfile = () => {
    if (!printContent) return
    log(`Печать единой анкеты: ${printDraft ? 'личный черновик' : `представленная версия ${presented?.version}`}`,
      printDraft ? 'private' : 'submitted')
    window.print()
  }
  const printTemplate = () => { log('Печать учебного шаблона'); window.print() }
  const chooseSignalVersion = (version: number) => {
    if (!versions.some((item) => item.version === version)) return
    setSelectedSignalVersion(version)
    setSelectedSignal(0)
    setReviewComment('')
    log(`Просмотр сигналов представленной версии ${version}`, 'submitted')
  }
  const nav = role === 'reservist' ? reservistNav : reviewerNav
  const activeNav = ['category', 'payment', 'support', 'insurance', 'housing'].includes(screen) ? 'payments' : screen
  const reviewerScreens: Screen[] = ['queue', 'case', 'documents', 'signals', 'messages', 'result', 'history', 'instructions', 'print', 'templates']
  const protectedReviewerScreen = role === 'reviewer' && (!reviewerScreens.includes(screen)
    || (!sent && !['queue', 'instructions', 'templates'].includes(screen)))

  return {
    role, screen, phase, draft, candidate: draft.candidate, versions, presented, accepted, setAccepted,
    activeCategory, setActiveCategory, categoryAnswers: draft.categoryAnswers, setCategoryAnswer,
    housingAnswer,
    setHousingAnswer: (value: string) => setCategoryAnswer(8, value), supportLevels: draft.supportLevels, setSupportLevel,
    relativeAnswer: draft.relativeAnswer, setRelativeAnswer, kinship: draft.kinship, updateKinship,
    personalInsuranceAnswer: draft.personalInsuranceAnswer, setPersonalInsuranceAnswer,
    activityAnswer: draft.activityAnswer, setActivityAnswer, consent, setConsent, consentDocument,
    corrected, mobileNav, setMobileNav, preview, setPreview,
    servicePeriods: draft.servicePeriods, familyRecipients: draft.familyRecipients, activities: draft.activities,
    records: draft.records, attachments: draft.attachments, selectedSignal, setSelectedSignal,
    reviewComment, setReviewComment, question, questionAuthor, reply, setReply,
    reviewChecks, setReviewChecks,
    decisionComment, setDecisionComment, decisionBasis, setDecisionBasis, decisionStatus, setDecisionStatus,
    decisionFile: decisionDocument?.name || '', decisionDocument, decisionAuthor, attachDecision, finalDecision, canDecide,
    signalDecisions, signalDecision, reviewedSignals, chooseSignalVersion, signalReadOnly,
    documentAssessments, selectedDocument, chooseDocument, documentComment, setDocumentComment,
    documentStatus, setDocumentStatus, assessDocument, clarifyDocument,
    query, setQuery, queueFilter, setQueueFilter, toast, setToast, audit,
    completeness, selfCheckReport: completeness, ready, sent, workingVersion, presentedCorrected,
    visibleContent, visibleCandidate, visibleAttachments, privateReply: reply, progress: completeness.progress,
    documentCount, recordCount, profileStatus, summary, hasDraftChanges, reviewerClosed, signals, signalVersion, historicalSignals, currentSignals,
    log, navigate, showDocument, recordDownload, addAttachment, removeAttachment, attachRecordDocument, attachProfileDocument,
    attachActivityDocument, attachConsent, attachPhoto, addServicePeriod,
    updateServicePeriod: (id: string, field: string, value: string) => updateList('servicePeriods', id, field, value),
    removeServicePeriod: (id: string) => removeListItem('servicePeriods', id),
    addRecipient, updateRecipient: (id: string, field: string, value: string) => updateList('familyRecipients', id, field, value),
    removeRecipient: (id: string) => removeListItem('familyRecipients', id),
    addActivity, updateActivity: (id: string, field: string, value: string) => updateList('activities', id, field, value),
    removeActivity: (id: string) => removeListItem('activities', id),
    addRecord, updateRecord, removeRecord, updateCandidate, repeatSelfCheck, recordSignalDecision,
    submit, loadDemoMaterial, requestClarification, prepareCorrection, complete, exportSummary,
    printSource, setPrintSource, printContent, printDraft, printProfile, templateId, setTemplateId, printTemplate,
    nav, activeNav, protectedReviewerScreen
  }
}

export type ProfileModel = ReturnType<typeof useProfileModel>
