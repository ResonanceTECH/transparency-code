import { api } from '../shared/api'
import type { Attachment, CandidateDetails, Entity, JsonValue, ProfileContent, PresentedSnapshot } from './types'

export type ServerStatus = 'draft' | 'submitted' | 'accepted' | 'clarification' | 'resubmitted' | 'completed' | 'removed'
export type WireQuestionnaire = {
  candidate: Record<string, string>
  service_periods: Entity[]
  relative_answer: string
  kinship: Record<string, string>
  family_recipients: Entity[]
  category_answers: Record<string, string>
  support_levels: Record<string, string>
  personal_insurance_answer: string
  records: Record<string, Entity[]>
  activity_answer: string
  activities: Entity[]
  attachments: Attachment[]
  consent_document_id: string
  photo: Attachment | null
  legacy_data: Record<string, JsonValue>
}
export type ServerDraft = {
  profile_id: string; status: ServerStatus; progress: number; questionnaire: WireQuestionnaire
  revision: number; updated_at: string; private_reply: string; editable: boolean
  versions_total: number
  is_demo: boolean; can_load_demo: boolean; contract_version: string
}
export type ServerVersion = {
  id: string; number: number; status: ServerStatus; progress: number; created_at: string
}
export type ServerVersionDetail = ServerVersion & {
  profile_revision: number
  snapshot: {
    questionnaire: WireQuestionnaire
    reply?: string
    _meta?: { is_demo?: boolean; confirmed?: boolean; transfer_confirmed_at?: string }
  }
}
export type ServerDocument = {
  id: string; filename: string; kind: string; size: number; created_at: string; section: string
  origin: 'upload' | 'sample'; url: string; profile_revision: number
  version_number: number | null
}
export type ServerSignalDecision = {
  id: string; status: 'reviewed' | 'clarification' | 'dismissed' | 'included'
  comment: string; author_name: string; created_at: string
}
export type ServerSignal = {
  id: string; rule_id: string; title: string; explanation: string; action: string; payload: Record<string, JsonValue>
  version_number: number; status: 'unreviewed' | ServerSignalDecision['status']; decisions: ServerSignalDecision[]
}
export type ServerAssessment = {
  id: string; document_id: string; version_id: string; version_number: number
  status: 'usable' | 'details' | 'unreadable'; comment: string; author_name: string; created_at: string
}
export type ServerReview = {
  id: string; result: 'completed' | 'removed'; basis_text: string; comment: string; author_name: string
  document_id: string | null; version_id: string | null; checks: boolean[]; created_at: string
}
export type ServerReviewState = { reviews: ServerReview[]; document_assessments: ServerAssessment[]; result_documents: ServerDocument[] }
export type ServerMessage = {
  id: string; author_role: string; author_name: string; kind: 'question' | 'reply' | 'note'; text: string
  created_at: string; version_number: number | null
}
export type ServerAudit = {
  id: string; actor_name: string; actor_role: string; scope: 'private' | 'submitted'; action: string; created_at: string
}
export type ServerContact = { id: string; name: string; responsibility: string; phone: string; email: string }
export type ServerQueueItem = {
  profile_id: string; full_name: string; program: string; status: ServerStatus; progress: number
  submitted_at: string; pending_signals: number; reviewer_name: string; version_number: number
  region: string; reporting_period: string; program_year: string; is_demo: boolean
}
export type ServerCase = ServerReviewState & {
  profile_id: string; status: ServerStatus; revision: number; version: ServerVersionDetail; signals: ServerSignal[]
  messages: ServerMessage[]; contract_version: string; is_demo: boolean
}
export type ServerDiff = { version_from: number; version_to: number; changed: number; entries: { path: string; before: JsonValue; after: JsonValue }[] }

// Только имена ключей. Деньги, даты и прочие значения не округляются/не нормализуются.
const fieldKeys: Record<string, string> = {
  fullName: 'full_name', birthYear: 'birth_year', workStatus: 'work_status', reportingPeriod: 'reporting_period',
  programYear: 'program_year', regionalProgram: 'regional_program', regionalProgramYear: 'regional_program_year',
  appointmentAuthority: 'appointment_authority', diplomaDetails: 'diploma_details', reserveActDetails: 'reserve_act_details',
  diplomaDocumentId: 'diploma_document_id', reserveActDocumentId: 'reserve_act_document_id', receivedPayments: 'received_payments',
  periodFrom: 'period_from', periodTo: 'period_to', paymentDate: 'payment_date', eventDate: 'event_date',
  recipientKind: 'recipient_kind', recipientId: 'recipient_id', basisType: 'basis_type', documentId: 'document_id',
  assignmentId: 'assignment_id', eventKind: 'event_kind', expectedYear: 'expected_year', housingKind: 'housing_kind',
  decisionDate: 'decision_date', acquisitionDate: 'acquisition_date'
}
const localKeys = Object.fromEntries(Object.entries(fieldKeys).map(([local, wire]) => [wire, local]))
function renameFields<T>(row: Record<string, string>, keys: Record<string, string>): T {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [keys[key] || key, value])) as T
}
function safeAttachment(file: Attachment): Attachment {
  const allowed = /^\/api\/(?:profile\/documents|reviewer\/profiles\/[a-f0-9-]+\/documents)\/[a-f0-9-]+\/file(?:\?|$)/i.test(file.url)
  return { ...file, url: allowed ? file.url : '' }
}
function versionUrl(url: string, version?: number | null): string {
  if (!url || !version) return url
  const value = new URL(url, window.location.origin)
  value.searchParams.set('version', String(version))
  return value.pathname + value.search
}
export function encodeQuestionnaire(content: ProfileContent): WireQuestionnaire {
  return {
    candidate: renameFields(content.candidate as unknown as Record<string, string>, fieldKeys),
    service_periods: content.servicePeriods.map((row) => renameFields<Entity>(row, fieldKeys)),
    relative_answer: content.relativeAnswer, kinship: renameFields(content.kinship, fieldKeys),
    family_recipients: content.familyRecipients.map((row) => renameFields<Entity>(row, fieldKeys)),
    category_answers: { ...content.categoryAnswers }, support_levels: { ...content.supportLevels },
    personal_insurance_answer: content.personalInsuranceAnswer,
    records: Object.fromEntries(Object.entries(content.records).map(([key, rows]) => [key, rows.map((row) => renameFields<Entity>(row, fieldKeys))])),
    activity_answer: content.activityAnswer, activities: content.activities.map((row) => renameFields<Entity>(row, fieldKeys)),
    attachments: content.attachments.map((file) => ({ ...file })), consent_document_id: content.consentDocumentId,
    photo: content.photo ? { ...content.photo } : null, legacy_data: structuredClone(content.legacyData || {})
  }
}
export function decodeQuestionnaire(q: WireQuestionnaire): ProfileContent {
  return {
    candidate: renameFields<CandidateDetails>(q.candidate, localKeys),
    servicePeriods: q.service_periods.map((row) => renameFields<Entity>(row, localKeys)), relativeAnswer: q.relative_answer,
    kinship: renameFields(q.kinship, localKeys), familyRecipients: q.family_recipients.map((row) => renameFields<Entity>(row, localKeys)),
    categoryAnswers: { ...q.category_answers }, supportLevels: { ...q.support_levels }, personalInsuranceAnswer: q.personal_insurance_answer,
    records: Object.fromEntries(Object.entries(q.records).map(([key, rows]) => [key, rows.map((row) => renameFields<Entity>(row, localKeys))])),
    activityAnswer: q.activity_answer, activities: q.activities.map((row) => renameFields<Entity>(row, localKeys)),
    attachments: q.attachments.map(safeAttachment), consentDocumentId: q.consent_document_id,
    photo: q.photo ? safeAttachment(q.photo) : null, legacyData: structuredClone(q.legacy_data || {})
  }
}
export function timeText(value: string): string {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' }) : value
}
export function decodeVersion(version: ServerVersionDetail, profileId: string): PresentedSnapshot {
  const content = decodeQuestionnaire(version.snapshot.questionnaire)
  for (const file of [...content.attachments, ...(content.photo ? [content.photo] : [])]) {
    file.url = versionUrl(file.url, version.number)
  }
  return { ...content, id: version.id, profileId, version: version.number, corrected: version.number > 1,
    createdAt: timeText(version.created_at), demo: !!version.snapshot._meta?.is_demo, documentCount: content.attachments.length,
    transferConfirmedAt: version.snapshot._meta?.confirmed ? timeText(version.snapshot._meta.transfer_confirmed_at || version.created_at) : '',
    reply: version.snapshot.reply || '' }
}
export function decodeDocument(doc: ServerDocument): Attachment {
  return safeAttachment({ id: doc.id, name: doc.filename, size: doc.size, format: doc.filename.split('.').pop()?.toLowerCase() || '',
    kind: ['consent', 'photo', 'result'].includes(doc.kind) ? doc.kind as Attachment['kind'] : 'basis',
    section: doc.section, origin: doc.origin, url: versionUrl(doc.url, doc.version_number) })
}
export function accountApi(username: string, signal: AbortSignal) {
  return <T,>(path: string, options: RequestInit = {}) => api<T>(path, {
    ...options, signal, headers: { ...options.headers, 'X-Profile-Account': username }
  })
}
export function assertContract(version: string) {
  if (version !== 'questionnaire-v1') throw new Error('На сервере старый контракт. Разверните обновлённый backend и миграцию; переключения прокси недостаточно.')
}
