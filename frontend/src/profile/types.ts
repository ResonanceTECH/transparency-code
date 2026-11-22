import type { ReactNode } from 'react'

export type Role = 'reservist' | 'reviewer'
export type Screen =
  | 'home'
  | 'profile'
  | 'kinship'
  | 'payments'
  | 'category'
  | 'payment'
  | 'support'
  | 'insurance'
  | 'housing'
  | 'activities'
  | 'documents'
  | 'selfcheck'
  | 'messages'
  | 'queue'
  | 'case'
  | 'signals'
  | 'result'
  | 'history'
  | 'instructions'
  | 'print'
  | 'templates'
export type Phase = 'draft' | 'submitted' | 'clarification' | 'resubmitted' | 'completed' | 'removed'
export type Tone = 'teal' | 'amber' | 'blue' | 'red' | 'neutral'
export type AuditEvent = { action: string; actor: string; role: Role; scope: 'private' | 'submitted'; time: string }
export type CandidateDetails = {
  fullName: string
  birthYear: string
  workplace: string
  workStatus: string
  phone: string
  email: string
  reportingPeriod: string
  region: string
  flow: string
  programYear: string
  regionalProgram: string
  regionalProgramYear: string
  appointmentAuthority: string
  organizer: string
  diplomaDetails: string
  reserveActDetails: string
  diplomaDocumentId: string
  reserveActDocumentId: string
}
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type ProfileContent = {
  candidate: CandidateDetails
  servicePeriods: Entity[]
  relativeAnswer: string
  kinship: { fullName: string; degree: string; status: string; receivedPayments: string }
  familyRecipients: Entity[]
  categoryAnswers: Record<number, string>
  supportLevels: Record<string, string>
  personalInsuranceAnswer: string
  records: Record<number, Entity[]>
  activityAnswer: string
  activities: Entity[]
  attachments: Attachment[]
  consentDocumentId: string
  photo: Attachment | null
  legacyData?: Record<string, JsonValue>
}
export type PresentedSnapshot = ProfileContent & {
  id: string
  profileId: string
  version: number
  corrected: boolean
  createdAt: string
  demo: boolean
  transferConfirmedAt: string
  documentCount: number
  reply: string
}
export type SignalDecision = {
  version: number
  code: string
  status: 'Рассмотрено' | 'Запрошено уточнение' | 'Исключено с обоснованием' | 'Включён с комментарием'
  comment: string
  author: string
  time: string
}
export type NavItem = { screen: Screen; title: string; icon: ReactNode }

export type Entity = { id: string; [key: string]: string }
export type Attachment = {
  id: string
  name: string
  url: string
  size: number
  format: string
  section: string
  kind: 'basis' | 'consent' | 'photo' | 'result'
  origin: 'sample' | 'upload'
}
export type Preview = { name: string; url: string }
export type DocumentAssessment = {
  documentId: string
  version: number
  status: 'Пригоден для сопоставления' | 'Нужна конкретика' | 'Нечитаемый или неполный скан'
  comment: string
  author: string
  time: string
}
