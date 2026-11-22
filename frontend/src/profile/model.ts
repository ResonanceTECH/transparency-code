import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../shared/api'
import type {
  Role, Screen, Phase, CandidateDetails, PresentedSnapshot, ProfileContent, SignalDecision,
  AuditEvent, Entity, Attachment, Preview, DocumentAssessment
} from './types'
import {
  accountApi, assertContract, decodeDocument, decodeQuestionnaire, decodeVersion, encodeQuestionnaire, timeText,
  type ServerAssessment, type ServerAudit, type ServerCase, type ServerContact, type ServerDiff,
  type ServerDocument, type ServerDraft, type ServerMessage, type ServerQueueItem, type ServerReviewState,
  type ServerSignal, type ServerSignalDecision, type ServerStatus, type ServerVersion, type ServerVersionDetail
} from './api'
import { createEmptyContent, headings, reservistNav, reviewerNav, categoryDefinitions } from './data'
import { activeRecords, assessContent, financialSummary, paymentFields, publishedContent } from './fields'
import { profileSignals, type ProfileSignal } from './signals'

const nextId = () => crypto.randomUUID()
const copy = <T,>(value: T): T => structuredClone(value)
const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered)
  : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, ordered(item)])) : value
const signature = (content: ProfileContent, reply: string) => JSON.stringify(ordered({ questionnaire: encodeQuestionnaire(content), reply }))
function comparable(content: ProfileContent) {
  const q = encodeQuestionnaire(publishedContent(content))
  // Технические SQL-ID не являются изменением дополнительных реквизитов.
  const stable = (value: unknown): unknown => value !== null && typeof value === 'object'
    ? Array.isArray(value) ? value.map(stable) : Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'source_id').map(([key, item]) => [key, stable(item)])) : value
  q.legacy_data = stable(q.legacy_data) as typeof q.legacy_data
  if (Array.isArray(q.legacy_data.additional_relatives)) q.legacy_data.additional_relatives = q.legacy_data.additional_relatives.map((relative) =>
    relative !== null && typeof relative === 'object' && !Array.isArray(relative) ? Object.fromEntries(Object.entries(relative).filter(([key]) => key !== 'id')) : relative)
  q.attachments = q.attachments.map((file) => ({ ...file, url: '' }))
  if (q.photo) q.photo = { ...q.photo, url: '' }
  return JSON.stringify(ordered(q))
}
const decisionLabels: Record<ServerSignalDecision['status'], SignalDecision['status']> = {
  reviewed: 'Рассмотрено', clarification: 'Запрошено уточнение', dismissed: 'Исключено с обоснованием', included: 'Включён с комментарием'
}
const assessmentLabels: Record<ServerAssessment['status'], DocumentAssessment['status']> = {
  usable: 'Пригоден для сопоставления', details: 'Нужна конкретика', unreadable: 'Нечитаемый или неполный скан'
}
const statusLabels: Record<ServerStatus, string> = {
  draft: 'Личный черновик', submitted: 'Сведения представлены', accepted: 'Принят к рассмотрению',
  clarification: 'Требуется уточнение', resubmitted: 'Сведения представлены повторно',
  completed: 'Рассмотрение завершено', removed: 'Снят с рассмотрения обоснованием'
}
function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url)
}

export function useProfileModel(role: Role = 'reservist', actorName = '', accountName = '') {
  const [screen, setScreen] = useState<Screen>(role === 'reservist' ? 'home' : 'queue')
  const [serverStatus, setServerStatus] = useState<ServerStatus>('draft')
  const [draft, setDraft] = useState<ProfileContent>(createEmptyContent)
  const [versions, setVersions] = useState<PresentedSnapshot[]>([])
  const [profileKey, setProfileKey] = useState('')
  const [queueItems, setQueueItems] = useState<ServerQueueItem[]>([])
  const [contacts, setContacts] = useState<ServerContact[]>([])
  const [messages, setMessages] = useState<ServerMessage[]>([])
  const [storedSignals, setStoredSignals] = useState<ServerSignal[]>([])
  const [storedAssessments, setStoredAssessments] = useState<ServerAssessment[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [reviewStale, setReviewStale] = useState(false)
  const [error, setError] = useState('')
  const [saveState, setSaveState] = useState<'loading' | 'saved' | 'dirty' | 'saving' | 'error'>('loading')
  const [savedAt, setSavedAt] = useState('')
  const [canLoadDemo, setCanLoadDemo] = useState(false)
  const [activeCategory, setActiveCategory] = useState(0)
  const [consent, setConsent] = useState(false)
  const [corrected, setCorrected] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [selectedSignal, setSelectedSignal] = useState(0)
  const [selectedSignalVersion, setSelectedSignalVersion] = useState<number | null>(null)
  const [reviewComment, setReviewComment] = useState('')
  const [reply, updateReply] = useState('')
  const [reviewChecks, setReviewChecks] = useState<boolean[]>([false, false, false])
  const [decisionComment, setDecisionComment] = useState('')
  const [decisionBasis, setDecisionBasis] = useState('')
  const [decisionDocument, setDecisionDocument] = useState<Attachment | null>(null)
  const [decisionDocumentVersion, setDecisionDocumentVersion] = useState<number | null>(null)
  const [decisionStatus, setDecisionStatus] = useState('Рассмотрение завершено')
  const [decisionAuthor, setDecisionAuthor] = useState('')
  const [selectedDocument, setSelectedDocument] = useState('')
  const [documentComment, setDocumentComment] = useState('')
  const [documentStatus, setDocumentStatus] = useState<DocumentAssessment['status']>('Пригоден для сопоставления')
  const [query, setQuery] = useState('')
  const [queueFilter, setQueueFilter] = useState('Все')
  const [toast, setToast] = useState('')
  const [printSource, setPrintSource] = useState<'draft' | 'submitted'>(role === 'reservist' ? 'draft' : 'submitted')
  const [printVersion, setPrintVersion] = useState<number | null>(null)
  const [templateId, setTemplateId] = useState('profile')
  const [versionDiff, setVersionDiff] = useState<ServerDiff | null>(null)

  const controller = useRef(new AbortController())
  const alive = useRef(true)
  const generation = useRef(0)
  const lifecycle = useRef(0)
  const operations = useRef<Promise<unknown>>(Promise.resolve())
  const revision = useRef(0)
  const draftRef = useRef(draft)
  const replyRef = useRef(reply)
  const profileRef = useRef(profileKey)
  const statusRef = useRef(serverStatus)
  const busyRef = useRef(false)
  const loadingRef = useRef(true)
  const savedSignature = useRef('')
  const saveBlocked = useRef(false)
  const caseIdentity = useRef('')
  const reviewStaleRef = useRef(false)
  draftRef.current = draft; replyRef.current = reply; profileRef.current = profileKey; statusRef.current = serverStatus
  const request = <T,>(path: string, options: RequestInit = {}) => accountApi(accountName, controller.current.signal)<T>(path, options)
  const editable = role === 'reservist' && !!profileKey && ['draft', 'clarification'].includes(serverStatus) && !loading
  const presented = versions.at(-1) || null
  const sent = presented !== null
  const phase: Phase = serverStatus === 'accepted' ? presented && presented.version > 1 ? 'resubmitted' : 'submitted' : serverStatus
  const accepted = serverStatus === 'accepted'
  const reviewerClosed = ['completed', 'removed'].includes(serverStatus)
  const completeness = assessContent(draft)
  const ready = editable && completeness.missing === 0 && !busy && !saveBlocked.current
  const workingVersion = (presented?.version || 0) + 1
  const visibleContent = role === 'reviewer' || reviewerClosed ? presented || createEmptyContent() : draft
  const visibleCandidate = visibleContent.candidate
  const visibleAttachments = visibleContent.attachments
  const documentCount = visibleAttachments.length
  const consentDocument = draft.attachments.find((file) => file.id === draft.consentDocumentId) || null
  const profileStatus = statusLabels[serverStatus]
  const profileId = profileKey || 'Профиль не выбран'
  const summary = financialSummary(visibleContent)
  const recordCount = Array.from({ length: 10 }, (_, category) => activeRecords(visibleContent, category).length).reduce((a, b) => a + b, 0)
  const signalSource = versions.find((item) => item.version === selectedSignalVersion) || presented
  const signalVersion = signalSource?.version || 1
  const historicalSignals = !!presented && signalVersion !== presented.version
  const reviewReadOnly = role !== 'reviewer' || reviewerClosed || reviewStale || loading
  const signalReadOnly = reviewReadOnly || historicalSignals || busy
  const materialSignals = (source: PresentedSnapshot | null): (ProfileSignal & { id: string })[] => {
    if (!source) return []
    const evidence = profileSignals(source)
    return storedSignals.filter((signal) => signal.version_number === source.version).map((signal, index) => {
      const details = evidence.find((item) => item.code === signal.rule_id)
      return { code: signal.rule_id, title: signal.title, type: details?.type || 'Сопоставление сведений', action: signal.action,
        index, id: signal.id, text: signal.explanation,
        leftTitle: details?.leftTitle || 'Представленная версия', rightTitle: details?.rightTitle || 'Что сопоставить',
        left: details?.left || [['Версия', String(source.version)]], right: details?.right || [['Действие', signal.action]],
        quote: details?.quote || 'Проверка выполнена по введённым сведениям. Содержание скана не распознавалось.' }
    })
  }
  const signals = materialSignals(signalSource)
  const currentSignals = materialSignals(presented)
  const signalDecisions: Record<string, SignalDecision> = {}
  for (const signal of storedSignals) for (const item of signal.decisions) signalDecisions[`${signal.version_number}:${signal.rule_id}`] = {
    version: signal.version_number, code: signal.rule_id, status: decisionLabels[item.status], comment: item.comment,
    author: item.author_name, time: timeText(item.created_at)
  }
  const documentAssessments: Record<string, DocumentAssessment> = {}
  for (const item of storedAssessments) documentAssessments[`${item.version_number}:${item.document_id}`] = {
    documentId: item.document_id, version: item.version_number, status: assessmentLabels[item.status], comment: item.comment,
    author: item.author_name, time: timeText(item.created_at)
  }
  const signalDecision = (code: string, version = signalVersion) => signalDecisions[`${version}:${code}`]
  const reviewedSignals = (version = signalVersion) => Object.values(signalDecisions).filter((item) =>
    item.version === version && item.status !== 'Запрошено уточнение').length
  const hasDraftChanges = !!presented && editable && (comparable(draft) !== comparable(presented) || !!reply)
  const hasUnsavedChanges = !!profileKey && (saveState === 'dirty' || saveState === 'saving' || saveState === 'error')
  const questionMessage = messages.filter((item) => item.kind === 'question').at(-1)
  const question = questionMessage?.text || ''
  const questionAuthor = questionMessage?.author_name || ''

  const reportError = (failure: unknown) => {
    if (!alive.current || failure instanceof DOMException && failure.name === 'AbortError') return
    if (role === 'reviewer' && failure instanceof ApiError && failure.status === 409) { reviewStaleRef.current = true; setReviewStale(true) }
    setError(failure instanceof Error ? failure.message : 'Операция не выполнена. Проверьте подключение к серверу.')
  }
  const serial = <T,>(operation: () => Promise<T>): Promise<T> => {
    const result = operations.current.then(operation, operation)
    operations.current = result.then(() => undefined, () => undefined)
    return result
  }
  const perform = (operation: () => Promise<boolean | void>, success = '') => serial(async () => {
    if (!alive.current) return false
    busyRef.current = true; setBusy(true); setError('')
    try {
      const result = await operation()
      if (!alive.current || result === false) return false
      if (success) setToast(success)
      return true
    } catch (failure) { reportError(failure); return false }
    finally { busyRef.current = false; if (alive.current) setBusy(false) }
  })
  const putStatus = (status: ServerStatus) => { statusRef.current = status; setServerStatus(status) }
  const refreshConfirmed = async (operation: () => Promise<void>, action: string) => {
    try { await operation() }
    catch (failure) {
      if (!alive.current || failure instanceof DOMException && failure.name === 'AbortError') return
      if (role === 'reviewer') { reviewStaleRef.current = true; setReviewStale(true) }
      setError(`${action} подтверждено сервером, но обновление экрана не завершено. Нажмите «Обновить с сервера». ${failure instanceof Error ? failure.message : ''}`)
    }
  }
  const hydrateAudit = (items: ServerAudit[]) => setAudit(items.map((event) => ({
    action: event.action, actor: event.actor_name, role: event.actor_role === 'reservist' ? 'reservist' : 'reviewer',
    scope: event.scope, time: timeText(event.created_at)
  })))
  const hydrateResult = (state: ServerReviewState, reset: boolean) => {
    const result = state.reviews.at(-1)
    if (result) {
      setDecisionBasis(result.basis_text); setDecisionComment(result.comment); setDecisionAuthor(result.author_name)
      setDecisionStatus(statusLabels[result.result]); setReviewChecks(result.checks)
      const document = state.result_documents.find((doc) => doc.id === result.document_id)
      setDecisionDocument(document ? decodeDocument(document) : null); setDecisionDocumentVersion(document?.version_number || null)
    } else if (reset) {
      setDecisionComment(''); setDecisionBasis(''); setDecisionAuthor(''); setReviewChecks([false, false, false])
      const document = state.result_documents.at(-1)
      setDecisionStatus('Рассмотрение завершено'); setDecisionDocument(document ? decodeDocument(document) : null)
      setDecisionDocumentVersion(document?.version_number || null)
    }
  }
  async function loadOwner(overwrite = true, attempt = 0): Promise<void> {
    const token = ++generation.current
    const [data, meta, messageData, signalData, auditData, reviewState] = await Promise.all([
      request<ServerDraft>('/profile'), request<ServerVersion[]>('/profile/versions'), request<ServerMessage[]>('/profile/messages'),
      request<ServerSignal[]>('/profile/signals'), request<ServerAudit[]>('/profile/audit'), request<ServerReviewState>('/profile/review-state')
    ])
    assertContract(data.contract_version)
    const details = await Promise.all(meta.map((version) => request<ServerVersionDetail>(`/profile/versions/${version.number}`)))
    const checked = await request<ServerDraft>('/profile')
    if (!alive.current || token !== generation.current) return
    assertContract(checked.contract_version)
    if (checked.profile_id !== data.profile_id || checked.revision !== data.revision || checked.versions_total !== meta.length || details.some((version) => version.profile_revision !== checked.revision)) {
      if (attempt < 1) return loadOwner(overwrite, attempt + 1)
      throw new Error('Профиль меняется в другой вкладке. Данные не заменены; повторите обновление.')
    }
    profileRef.current = checked.profile_id; setProfileKey(checked.profile_id); putStatus(checked.status)
    setVersions(details.sort((a, b) => a.number - b.number).map((version) => decodeVersion(version, data.profile_id)))
    setMessages(messageData); setStoredSignals(signalData); setStoredAssessments(reviewState.document_assessments); hydrateAudit(auditData); hydrateResult(reviewState, true)
    if (overwrite) {
      const content = decodeQuestionnaire(checked.questionnaire)
      draftRef.current = content; setDraft(content); replyRef.current = checked.private_reply; updateReply(checked.private_reply)
      revision.current = checked.revision; savedSignature.current = signature(content, checked.private_reply)
      saveBlocked.current = false; setSaveState('saved'); setSavedAt(timeText(checked.updated_at)); setCanLoadDemo(checked.can_load_demo)
    }
    loadingRef.current = false; setLoading(false)
  }
  async function loadQueue() {
    const data = await request<ServerQueueItem[]>('/reviewer/queue')
    if (alive.current) setQueueItems(data)
  }
  async function loadCase(id: string, reset = false, attempt = 0): Promise<void> {
    const token = ++generation.current
    const [latest, meta, auditData] = await Promise.all([
      request<ServerCase>(`/reviewer/profiles/${id}`), request<ServerVersion[]>(`/reviewer/profiles/${id}/versions`),
      request<ServerAudit[]>(`/reviewer/profiles/${id}/audit`)
    ])
    assertContract(latest.contract_version)
    const history = await Promise.all(meta.map((version) => version.number === latest.version.number ? Promise.resolve(latest)
      : request<ServerCase>(`/reviewer/profiles/${id}?version=${version.number}`)))
    const checked = await request<ServerCase>(`/reviewer/profiles/${id}`)
    if (!alive.current || token !== generation.current) return
    if (checked.revision !== latest.revision || checked.version.id !== latest.version.id || meta.at(-1)?.id !== latest.version.id || history.some((item) => item.revision !== checked.revision)) {
      if (attempt < 1) return loadCase(id, reset, attempt + 1)
      throw new Error('Представленный материал изменился во время загрузки. Обновите его перед решением.')
    }
    reset ||= caseIdentity.current !== `${id}:${latest.version.id}`
    caseIdentity.current = `${id}:${latest.version.id}`
    profileRef.current = id; setProfileKey(id); putStatus(latest.status)
    setVersions(history.sort((a, b) => a.version.number - b.version.number).map((item) => decodeVersion(item.version, id)))
    setStoredSignals(history.flatMap((item) => item.signals)); setStoredAssessments(history.flatMap((item) => item.document_assessments))
    setMessages(latest.messages); hydrateAudit(auditData); hydrateResult(latest, reset)
    if (reset) {
      setSelectedSignalVersion(null); setSelectedSignal(0); setReviewComment(''); setDocumentComment(''); setVersionDiff(null)
      setSelectedDocument(latest.version.snapshot.questionnaire.attachments[0]?.id || '')
      setDocumentStatus('Пригоден для сопоставления'); setPrintVersion(null)
    }
    reviewStaleRef.current = false; setReviewStale(false)
    loadingRef.current = false; setLoading(false)
  }
  async function saveNow(): Promise<boolean> {
    if (!alive.current || role !== 'reservist' || loadingRef.current || !profileRef.current || !['draft', 'clarification'].includes(statusRef.current)) return false
    if (saveBlocked.current) { setError('Есть конфликт ревизии. Сначала выгрузите локальную JSON-копию и обновите данные с сервера.'); return false }
    const current = copy(draftRef.current), text = replyRef.current, requested = signature(current, text)
    if (requested === savedSignature.current) return true
    setSaveState('saving')
    try {
      const data = await request<ServerDraft>('/profile', { method: 'PUT', body: JSON.stringify({
        questionnaire: encodeQuestionnaire(current), revision: revision.current, private_reply: text
      }) })
      assertContract(data.contract_version)
      if (!alive.current) return false
      const saved = decodeQuestionnaire(data.questionnaire)
      revision.current = data.revision; savedSignature.current = signature(saved, data.private_reply)
      if (signature(draftRef.current, replyRef.current) === requested) { draftRef.current = saved; setDraft(saved) }
      putStatus(data.status); setSavedAt(timeText(data.updated_at)); setCanLoadDemo(false); setError('')
      setSaveState(signature(draftRef.current, replyRef.current) === savedSignature.current ? 'saved' : 'dirty')
      return true
    } catch (failure) {
      if (failure instanceof ApiError && failure.status === 409) saveBlocked.current = true
      if (alive.current) setSaveState('error')
      reportError(failure); return false
    }
  }
  const saveDraft = () => serial(saveNow)
  const changeDraft = (change: (content: ProfileContent) => ProfileContent, internal = false) => {
    if (role !== 'reservist' || loadingRef.current || !['draft', 'clarification'].includes(statusRef.current) || busyRef.current && !internal) return
    const next = change(draftRef.current)
    draftRef.current = next; setDraft(next); setConsent(false); setCanLoadDemo(false); setSaveState(saveBlocked.current ? 'error' : 'dirty')
  }
  const setReply = (value: string) => {
    if (!editable || busyRef.current) return
    replyRef.current = value; updateReply(value); setConsent(false); setSaveState(saveBlocked.current ? 'error' : 'dirty')
  }
  const recordEvent = (event: 'view' | 'print' | 'template' | 'selfcheck' | 'open' | 'close', at: Screen = screen, version?: number) => {
    if (!profileRef.current || loadingRef.current) return
    const path = role === 'reservist' ? '/profile/events' : `/reviewer/profiles/${profileRef.current}/events`
    void request(path, { method: 'POST', body: JSON.stringify({ event, screen: at, version }) }).catch(reportError)
  }
  const log = (action: string, scope?: AuditEvent['scope']) => {
    if (action.startsWith('Просмотр')) recordEvent('view', screen, scope === 'submitted' ? presented?.version : undefined)
  }
  const navigate = (next: Screen) => {
    if (next === 'print') { setPrintSource(role === 'reservist' && !reviewerClosed ? 'draft' : 'submitted'); setPrintVersion(null) }
    setScreen(next); setMobileNav(false); setPreview(null); setToast('')
    recordEvent('view', next, role === 'reviewer' ? presented?.version : undefined)
    if (profileRef.current && ['history', 'home'].includes(next)) {
      const id = profileRef.current
      const path = role === 'reservist' ? '/profile/audit' : `/reviewer/profiles/${id}/audit`
      void request<ServerAudit[]>(path).then((data) => alive.current && profileRef.current === id && hydrateAudit(data)).catch(reportError)
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const saveAndNavigate = (next: Screen) => perform(async () => { if (!await saveNow()) return false; navigate(next) }, 'Черновик сохранён на сервере')
  const updateCandidate = (field: keyof CandidateDetails, value: string) => changeDraft((content) => ({ ...content, candidate: { ...content.candidate, [field]: value } }))
  const updateList = (list: 'servicePeriods' | 'familyRecipients' | 'activities', id: string, field: string, value: string) =>
    changeDraft((content) => ({ ...content, [list]: content[list].map((row) => row.id === id ? { ...row, [field]: value } : row) }))
  const removeListItem = (list: 'servicePeriods' | 'familyRecipients' | 'activities', id: string) =>
    changeDraft((content) => ({ ...content, [list]: content[list].filter((row) => row.id !== id) }))
  const addServicePeriod = () => changeDraft((content) => ({ ...content, servicePeriods: [...content.servicePeriods, { id: nextId(), kind: 'Военная служба', category: 'Младший офицерский состав', organization: '', start: '', end: '' }] }))
  const addRecipient = () => changeDraft((content) => ({ ...content, familyRecipients: [...content.familyRecipients, { id: nextId(), fullName: '', relation: '', year: '' }] }))
  const addActivity = () => changeDraft((content) => ({ ...content, activities: [...content.activities, { id: nextId(), organization: '', kind: 'Преподавание', engagement: 'Гражданско-правовой договор', periodFrom: '', periodTo: '', basis: '', documentId: '' }] }))
  const insuranceAnswer = (content: ProfileContent) => content.personalInsuranceAnswer === 'Да' || content.relativeAnswer === 'Да' && content.kinship.receivedPayments === 'Да' ? 'Да' : 'Нет'
  const setRelativeAnswer = (value: string) => changeDraft((content) => { const next = { ...content, relativeAnswer: value }; return { ...next, categoryAnswers: { ...next.categoryAnswers, 4: insuranceAnswer(next) } } })
  const updateKinship = (field: keyof ProfileContent['kinship'], value: string) => changeDraft((content) => { const next = { ...content, kinship: { ...content.kinship, [field]: value } }; return { ...next, categoryAnswers: { ...next.categoryAnswers, 4: insuranceAnswer(next) } } })
  const setPersonalInsuranceAnswer = (value: string) => changeDraft((content) => { const next = { ...content, personalInsuranceAnswer: value }; return { ...next, categoryAnswers: { ...next.categoryAnswers, 4: insuranceAnswer(next) } } })
  const setSupportLevel = (level: string, value: string) => changeDraft((content) => { const levels = { ...content.supportLevels, [level]: value }; return { ...content, supportLevels: levels, categoryAnswers: { ...content.categoryAnswers, 3: Object.values(levels).includes('Да') ? 'Да' : 'Нет' } } })
  const setCategoryAnswer = (category: number, value: string) => changeDraft((content) => ({ ...content, categoryAnswers: { ...content.categoryAnswers, [category]: value } }))
  const setActivityAnswer = (value: string) => changeDraft((content) => ({ ...content, activityAnswer: value }))
  const addRecord = (category: number, recipientKind = 'Сам резервист') => changeDraft((content) => {
    const row: Entity = { id: nextId(), title: '', amount: '', basis: '', documentId: '', recipient: content.candidate.fullName, recipientKind,
      recipientId: content.familyRecipients[0]?.id || '', form: 'Денежная', level: Object.entries(content.supportLevels).find(([, answer]) => answer === 'Да')?.[0] || 'Региональный',
      basisType: recipientKind === 'Резервист за родственника' ? 'В связи с родственником' : 'За личное участие' }
    for (const field of paymentFields(category, row, content)) if (!(field.key in row)) row[field.key] = field.options?.[0] || ''
    return { ...content, records: { ...content.records, [category]: [...content.records[category], row] } }
  })
  const updateRecord = (category: number, id: string, field: string, value: string) => changeDraft((content) => ({ ...content, records: { ...content.records, [category]: content.records[category].map((row) => row.id === id ? { ...row, [field]: value } : row) } }))
  const removeRecord = (category: number, id: string) => changeDraft((content) => ({ ...content, records: { ...content.records, [category]: content.records[category].filter((row) => row.id !== id) } }))

  const upload = (name: string, file: File | undefined, section: string, kind: Attachment['kind'], apply: (content: ProfileContent, attachment: Attachment) => ProfileContent) => perform(async () => {
    if (!await saveNow()) return false
    let document: ServerDocument
    if (file) {
      const body = new FormData(); body.append('file', file); body.append('kind', kind); body.append('section', section); body.append('revision', String(revision.current))
      document = await request<ServerDocument>('/profile/documents', { method: 'POST', body })
    } else document = await request<ServerDocument>('/profile/documents/sample', { method: 'POST', body: JSON.stringify({ name, section, kind, revision: revision.current }) })
    if (!alive.current) return false
    revision.current = document.profile_revision
    const attachment = decodeDocument(document)
    changeDraft((content) => apply({ ...content, attachments: kind === 'photo' ? content.attachments : [...content.attachments, attachment] }, attachment), true)
    const linked = await saveNow()
    if (alive.current && !linked) setError((previous) => `Файл «${document.filename}» сохранён сервером, но подтверждение его связи с полем не получено. Не загружайте файл повторно: сохраните локальную JSON-копию и обновите профиль. ${previous}`)
    return linked
  }, 'Файл и его связь с анкетой сохранены на сервере')
  const addAttachment = (name: string, file?: File) => upload(name, file, 'Дополнительный документ', 'basis', (content) => content)
  const attachRecordDocument = (category: number, id: string, name: string, file?: File) => upload(name, file, categoryDefinitions[category].title, 'basis', (content, attachment) => ({ ...content, records: { ...content.records, [category]: content.records[category].map((row) => row.id === id ? { ...row, documentId: attachment.id } : row) } }))
  const attachProfileDocument = (field: 'diplomaDocumentId' | 'reserveActDocumentId', name: string, file?: File) => upload(name, file, field === 'diplomaDocumentId' ? 'Программа «Время героев»' : 'Акт о включении в резерв', 'basis', (content, attachment) => ({ ...content, candidate: { ...content.candidate, [field]: attachment.id } }))
  const attachActivityDocument = (id: string, name: string, file?: File) => upload(name, file, 'Дополнительная деятельность', 'basis', (content, attachment) => ({ ...content, activities: content.activities.map((row) => row.id === id ? { ...row, documentId: attachment.id } : row) }))
  const attachConsent = (name: string, file?: File) => upload(name, file, 'Согласие на обработку персональных данных', 'consent', (content, attachment) => ({ ...content, consentDocumentId: attachment.id }))
  const attachPhoto = (file: File) => upload(file.name, file, 'Фото для карточки', 'photo', (content, attachment) => ({ ...content, photo: attachment }))
  const removeAttachment = (id: string) => perform(async () => {
    if (!await saveNow()) return false
    await request(`/profile/documents/${id}?revision=${revision.current}`, { method: 'DELETE' })
    if (!alive.current) return false
    revision.current++
    const content = draftRef.current
    const candidate = { ...content.candidate }
    for (const field of ['diplomaDocumentId', 'reserveActDocumentId'] as const) if (candidate[field] === id) candidate[field] = ''
    const next = { ...content, candidate, attachments: content.attachments.filter((file) => file.id !== id),
      photo: content.photo?.id === id ? null : content.photo, consentDocumentId: content.consentDocumentId === id ? '' : content.consentDocumentId,
      records: Object.fromEntries(Object.entries(content.records).map(([category, rows]) => [category, rows.map((row) => row.documentId === id ? { ...row, documentId: '' } : row)])),
      activities: content.activities.map((row) => row.documentId === id ? { ...row, documentId: '' } : row) }
    draftRef.current = next; setDraft(next); setConsent(false); setSaveState('saved'); setSavedAt('')
    savedSignature.current = signature(next, replyRef.current)
    await refreshConfirmed(() => loadOwner(true), 'Удаление из черновика')
  }, 'Файл удалён из черновика; оригиналы представленных версий сохранены')
  const showDocument = (name: string, url?: string) => {
    const matches = visibleAttachments.filter((file) => file.name === name)
    const actual = url !== undefined ? url : matches.length === 1 ? matches[0].url : decisionDocument?.name === name ? decisionDocument.url : ''
    if (!actual) { setError('Оригинал файла недоступен в этой версии. Запросите повторную загрузку.'); return }
    setPreview({ name, url: actual })
  }
  const recordDownload = (_name: string) => { /* Доступ к оригиналу фиксируется сервером, а не вымышленным событием клиента. */ }
  const attachDecision = (name: string, file?: File) => perform(async () => {
    if (role !== 'reviewer' || !presented || reviewReadOnly || reviewStaleRef.current || !file) return false
    const body = new FormData(); body.append('file', file); body.append('version', String(presented.version)); body.append('section', 'Основание результата')
    const doc = await request<ServerDocument>(`/reviewer/profiles/${profileRef.current}/documents`, { method: 'POST', body })
    if (!alive.current) return false
    setDecisionDocument(decodeDocument(doc))
    setDecisionDocumentVersion(doc.version_number)
  }, `Основание «${name}» сохранено для текущей версии`)
  const repeatSelfCheck = () => perform(async () => { if (!await saveNow()) return false; recordEvent('selfcheck', 'selfcheck') }, `Самопроверка: ${completeness.completed} из 7 блоков. Черновик сохранён на сервере.`)
  const submit = () => perform(async () => {
    if (role !== 'reservist' || !ready || !consent || !await saveNow()) return false
    const response = await request<ServerVersionDetail>('/profile/submit', { method: 'POST', body: JSON.stringify({ confirmed: true, revision: revision.current }) })
    if (!alive.current) return false
    revision.current = response.profile_revision
    const version = decodeVersion(response, profileRef.current)
    setVersions((items) => [...items.filter((item) => item.version !== version.version), version].sort((a, b) => a.version - b.version))
    putStatus(response.status)
    replyRef.current = ''; updateReply(''); savedSignature.current = signature(draftRef.current, ''); setSaveState('saved')
    setConsent(false); setSelectedSignalVersion(null)
    await refreshConfirmed(() => loadOwner(true), 'Представление версии')
  }, 'Сервер подтвердил представление неизменяемой версии')
  const loadDemoDraft = () => perform(async () => {
    if (!canLoadDemo || signature(draftRef.current, replyRef.current) !== savedSignature.current) return false
    const data = await request<ServerDraft>('/profile/demo', { method: 'POST' })
    assertContract(data.contract_version)
    if (!alive.current) return false
    const content = decodeQuestionnaire(data.questionnaire)
    draftRef.current = content; setDraft(content); revision.current = data.revision
    replyRef.current = data.private_reply; updateReply(data.private_reply); setConsent(false); setCanLoadDemo(false)
    savedSignature.current = signature(content, data.private_reply); setSaveState('saved'); setSavedAt(timeText(data.updated_at)); putStatus(data.status)
    await refreshConfirmed(() => loadOwner(true), 'Добавление учебных сведений')
  }, 'Учебные сведения добавлены в пустой черновик. Это не отправка на проверку.')
  const loadDemoMaterial = () => perform(async () => {
    const data = await request<ServerCase>('/reviewer/demo', { method: 'POST' }); assertContract(data.contract_version)
    if (!alive.current) return false
    profileRef.current = data.profile_id; setProfileKey(data.profile_id); putStatus(data.status)
    setVersions([decodeVersion(data.version, data.profile_id)]); setMessages(data.messages); setStoredSignals(data.signals)
    setStoredAssessments(data.document_assessments); hydrateResult(data, true); setAudit([]); setVersionDiff(null)
    setSelectedSignalVersion(null); setSelectedSignal(0); setReviewComment(''); setDocumentComment('')
    setSelectedDocument(data.version.snapshot.questionnaire.attachments[0]?.id || ''); setDocumentStatus('Пригоден для сопоставления'); setPrintVersion(null)
    navigate('case')
    await refreshConfirmed(async () => { await Promise.all([loadQueue(), loadCase(data.profile_id, true)]) }, 'Открытие учебного комплекта')
  }, 'Открыт отдельный учебный комплект. Личные черновики не использованы.')
  const openMaterial = (id: string) => perform(async () => { await loadCase(id, true); navigate('case') })
  const recordSignalDecision = (status: SignalDecision['status'], clarification = false) => perform(async () => {
    const signal = signals.find((item) => item.index === selectedSignal) || signals[0]
    if (role !== 'reviewer' || !signal || reviewReadOnly || reviewStaleRef.current || historicalSignals || reviewComment.trim().length < 5) return false
    const code = Object.entries(decisionLabels).find(([, label]) => label === status)![0]
    const decision = await request<ServerSignalDecision>(`/reviewer/signals/${signal.id}/decision`, { method: 'POST', body: JSON.stringify({ status: code, comment: reviewComment.trim(), version: signalVersion, request_clarification: clarification }) })
    if (!alive.current) return false
    setStoredSignals((items) => items.map((item) => item.id === signal.id ? { ...item, status: decision.status, decisions: [...item.decisions, decision] } : item))
    setReviewComment(''); if (clarification) putStatus('clarification')
    await refreshConfirmed(async () => { await Promise.all([loadCase(profileRef.current), loadQueue()]) }, 'Решение по сигналу')
    if (clarification) navigate('messages')
  }, clarification ? 'Запрос уточнения и комментарий подтверждены сервером' : 'Решение по сигналу сохранено с комментарием')
  const requestClarification = () => recordSignalDecision('Запрошено уточнение', true)
  const prepareCorrection = () => perform(async () => {
    if (role !== 'reservist' || phase !== 'clarification' || reply.trim().length < 10 || !await saveNow()) return false
    setCorrected(true); setConsent(false); navigate('selfcheck')
  }, 'Пояснение сохранено в личном черновике. Новая версия ещё не представлена.')
  const finalDecision = ['Рассмотрение завершено', 'Снят с рассмотрения обоснованием'].includes(decisionStatus)
  const unassessedDocuments = presented?.attachments.filter((file) => !file.url || documentAssessments[`${presented.version}:${file.id}`]?.status !== 'Пригоден для сопоставления').length || 0
  const unresolvedSignals = currentSignals.filter((signal) => !signalDecision(signal.code, presented?.version) || signalDecision(signal.code, presented?.version)?.status === 'Запрошено уточнение').length
  const canDecide = sent && !reviewReadOnly && !busy && decisionComment.trim().length >= (finalDecision ? 10 : 5)
    && (decisionStatus !== 'Принят к рассмотрению' || ['submitted', 'resubmitted'].includes(serverStatus))
    && (!finalDecision || phase !== 'clarification' && reviewChecks.every(Boolean) && decisionBasis.trim().length >= 5 && !!decisionDocument?.url && decisionDocumentVersion === presented?.version && unassessedDocuments === 0 && unresolvedSignals === 0)
  const complete = () => perform(async () => {
    if (role !== 'reviewer' || !canDecide || reviewStaleRef.current || !presented) return false
    const action = decisionStatus === 'Принят к рассмотрению' ? 'accept' : decisionStatus === 'Требуются уточнения' ? 'clarification' : decisionStatus === 'Рассмотрение завершено' ? 'complete' : 'remove'
    const response = await request<{ status: ServerStatus }>(`/reviewer/profiles/${profileRef.current}/decision`, { method: 'POST', body: JSON.stringify({ action, comment: decisionComment.trim(), basis: decisionBasis.trim(), document_id: finalDecision ? decisionDocument?.id : null, checks: reviewChecks, version: presented.version }) })
    if (!alive.current) return false
    putStatus(response.status)
    setQueueItems((items) => items.map((item) => item.profile_id === profileRef.current ? { ...item, status: response.status } : item))
    await refreshConfirmed(async () => { await Promise.all([loadCase(profileRef.current), loadQueue()]) }, 'Решение по материалу')
  }, 'Статус и комментарий подтверждены сервером')
  const chooseDocument = (id: string) => { setSelectedDocument(id); setDocumentComment(''); setDocumentStatus('Пригоден для сопоставления') }
  const assessDocument = (clarification = false) => perform(async () => {
    if (role !== 'reviewer' || !presented || reviewReadOnly || reviewStaleRef.current || documentComment.trim().length < 5) return false
    const status = Object.entries(assessmentLabels).find(([, label]) => label === documentStatus)![0]
    const assessment = await request<ServerAssessment>(`/reviewer/profiles/${profileRef.current}/documents/${selectedDocument}/assessment`, { method: 'POST', body: JSON.stringify({ version: presented.version, status, comment: documentComment.trim(), request_clarification: clarification }) })
    if (!alive.current) return false
    setStoredAssessments((items) => [...items.filter((item) => item.id !== assessment.id), assessment])
    setDocumentComment(''); if (clarification) putStatus('clarification')
    await refreshConfirmed(async () => { await Promise.all([loadCase(profileRef.current), loadQueue()]) }, 'Оценка документа')
    if (clarification) navigate('messages')
  }, clarification ? 'Оценка документа и запрос уточнения сохранены' : 'Ручная оценка документа сохранена с комментарием')
  const exportSummary = () => perform(async () => {
    if (role !== 'reviewer' || !presented) return false
    const result = await request(`/reviewer/profiles/${profileRef.current}/export`)
    downloadJson(result, `resonance-${profileRef.current}-v${presented.version}-result.json`)
  })
  const exportDraft = () => downloadJson({ profile_id: profileRef.current, submitted: false, local_unsaved: hasUnsavedChanges, questionnaire: encodeQuestionnaire(draftRef.current), private_reply: replyRef.current }, `resonance-${profileRef.current || 'draft'}-private.json`)
  const leaveAccount = (exit: () => void | Promise<void>) => perform(async () => {
    if (role === 'reservist' && profileRef.current && signature(draftRef.current, replyRef.current) !== savedSignature.current && !await saveNow()) return false
    if (profileRef.current) {
      const path = role === 'reservist' ? '/profile/events' : `/reviewer/profiles/${profileRef.current}/events`
      try { await request(path, { method: 'POST', body: JSON.stringify({ event: 'close', screen, version: role === 'reviewer' ? presented?.version : undefined }) }) }
      catch (failure) { if (!(failure instanceof ApiError && failure.status === 401)) throw failure }
    }
    await exit()
  })
  const reloadFromServer = () => perform(async () => {
    if (role === 'reservist') {
      if (hasUnsavedChanges && !window.confirm('Есть локальные несохранённые изменения. Загрузка заменит их серверным черновиком. При необходимости сначала выгрузите локальную JSON-копию. Продолжить?')) return false
      await loadOwner(true)
    } else { await loadQueue(); if (profileRef.current) await loadCase(profileRef.current) }
    setError('')
  }, 'Загружено актуальное состояние с сервера')
  const printDraft = role === 'reservist' && printSource === 'draft'
  const printedVersion = versions.find((item) => item.version === printVersion) || presented
  const printContent = printDraft ? draft : printedVersion
  const printProfile = () => {
    if (!printContent) return
    recordEvent('print', 'print', printDraft ? undefined : printedVersion?.version); window.print()
  }
  const printTemplate = () => { recordEvent('template', 'templates'); window.print() }
  const chooseSignalVersion = (version: number) => { if (versions.some((item) => item.version === version)) { setSelectedSignalVersion(version); setSelectedSignal(0); setReviewComment('') } }
  const printSubmittedVersion = (version: number) => { navigate('print'); setPrintSource('submitted'); setPrintVersion(version) }
  const loadDiff = () => perform(async () => {
    if (versions.length < 2) return false
    setVersionDiff(role === 'reviewer' ? await request<ServerDiff>(`/reviewer/profiles/${profileRef.current}/diff`)
      : await request<ServerDiff>(`/profile/versions/${versions.at(-2)!.version}/diff/${versions.at(-1)!.version}`))
  })

  useEffect(() => {
    const epoch = ++lifecycle.current
    alive.current = true; controller.current = new AbortController(); loadingRef.current = true
    void request<ServerContact[]>('/reference/contacts').then((data) => alive.current && setContacts(data)).catch(reportError)
    void (role === 'reservist' ? loadOwner() : loadQueue()).then(() => {
      if (!alive.current || epoch !== lifecycle.current) return
      loadingRef.current = false; setLoading(false)
      if (role === 'reservist') recordEvent('open', 'home')
    }).catch((failure) => {
      if (epoch !== lifecycle.current || failure instanceof DOMException && failure.name === 'AbortError') return
      reportError(failure); if (alive.current) { loadingRef.current = false; setLoading(false); setSaveState('error') }
    })
    return () => { alive.current = false; lifecycle.current++; generation.current++; controller.current.abort() }
  }, [role, accountName])
  useEffect(() => {
    if (!editable || busy || saveState !== 'dirty' || saveBlocked.current) return
    const timer = window.setTimeout(() => { void saveDraft() }, 700)
    return () => window.clearTimeout(timer)
  }, [draft, reply, editable, busy, saveState])
  useEffect(() => {
    if (!hasUnsavedChanges && !busy) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasUnsavedChanges, busy])
  useEffect(() => { document.title = screen === 'print' ? `Резонанс · анкета ${profileId}` : 'Резонанс · Финансовый профиль кандидата в резерв' }, [screen, profileId])
  useEffect(() => { if (toast) { const timer = window.setTimeout(() => setToast(''), 4200); return () => window.clearTimeout(timer) } }, [toast])

  const nav = role === 'reservist' ? reservistNav : reviewerNav
  const activeNav = ['category', 'payment', 'support', 'insurance', 'housing'].includes(screen) ? 'payments' : screen
  const reviewerScreens: Screen[] = ['queue', 'case', 'documents', 'signals', 'messages', 'result', 'history', 'instructions', 'print', 'templates']
  const protectedReviewerScreen = role === 'reviewer' && (!reviewerScreens.includes(screen) || !sent && !['queue', 'instructions', 'templates'].includes(screen))
  return {
    role, actorName, screen, phase, draft, candidate: draft.candidate, versions, presented, accepted, profileId,
    loading, busy, error, setError, editable, profileLoaded: !!profileKey, saveState, savedAt, hasUnsavedChanges, saveDraft, saveAndNavigate, reloadFromServer, exportDraft, leaveAccount,
    queueItems, openMaterial, contacts, messages, canLoadDemo, loadDemoDraft, versionDiff, loadDiff,
    activeCategory, setActiveCategory, categoryAnswers: draft.categoryAnswers, setCategoryAnswer, housingAnswer: draft.categoryAnswers[8],
    setHousingAnswer: (value: string) => setCategoryAnswer(8, value), supportLevels: draft.supportLevels, setSupportLevel,
    relativeAnswer: draft.relativeAnswer, setRelativeAnswer, kinship: draft.kinship, updateKinship,
    personalInsuranceAnswer: draft.personalInsuranceAnswer, setPersonalInsuranceAnswer, activityAnswer: draft.activityAnswer, setActivityAnswer,
    consent, setConsent, consentDocument, corrected, mobileNav, setMobileNav, preview, setPreview,
    servicePeriods: draft.servicePeriods, familyRecipients: draft.familyRecipients, activities: draft.activities, records: draft.records,
    attachments: draft.attachments, selectedSignal, setSelectedSignal, reviewComment, setReviewComment, question, questionAuthor, reply, setReply,
    reviewChecks, setReviewChecks, decisionComment, setDecisionComment, decisionBasis, setDecisionBasis, decisionStatus, setDecisionStatus,
    decisionFile: decisionDocument?.name || '', decisionDocument, decisionAuthor, attachDecision, finalDecision, canDecide, unassessedDocuments, unresolvedSignals,
    signalDecisions, signalDecision, reviewedSignals, chooseSignalVersion, signalReadOnly, reviewReadOnly, documentAssessments,
    selectedDocument, chooseDocument, documentComment, setDocumentComment, documentStatus, setDocumentStatus,
    assessDocument: () => assessDocument(), clarifyDocument: () => assessDocument(true), query, setQuery, queueFilter, setQueueFilter, toast, setToast, audit,
    completeness, selfCheckReport: completeness, ready, sent, workingVersion, presentedCorrected: presented?.corrected || false,
    visibleContent, visibleCandidate, visibleAttachments, privateReply: reply, progress: completeness.progress, documentCount, recordCount,
    profileStatus, summary, hasDraftChanges, reviewerClosed, signals, signalVersion, historicalSignals, currentSignals,
    log, navigate, showDocument, recordDownload, addAttachment, removeAttachment, attachRecordDocument, attachProfileDocument,
    attachActivityDocument, attachConsent, attachPhoto, addServicePeriod,
    updateServicePeriod: (id: string, field: string, value: string) => updateList('servicePeriods', id, field, value),
    removeServicePeriod: (id: string) => removeListItem('servicePeriods', id), addRecipient,
    updateRecipient: (id: string, field: string, value: string) => updateList('familyRecipients', id, field, value),
    removeRecipient: (id: string) => removeListItem('familyRecipients', id), addActivity,
    updateActivity: (id: string, field: string, value: string) => updateList('activities', id, field, value),
    removeActivity: (id: string) => removeListItem('activities', id), addRecord, updateRecord, removeRecord, updateCandidate,
    repeatSelfCheck, recordSignalDecision, submit, loadDemoMaterial, requestClarification, prepareCorrection, complete, exportSummary,
    printSource, setPrintSource, printContent, printDraft, printProfile, printedVersion, printSubmittedVersion, printVersion, setPrintVersion,
    templateId, setTemplateId, printTemplate, nav, activeNav, protectedReviewerScreen
  }
}
export type ProfileModel = ReturnType<typeof useProfileModel>
