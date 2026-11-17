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
export type Phase = 'draft' | 'submitted' | 'clarification' | 'resubmitted' | 'completed' | 'removed'
export type Tone = 'teal' | 'amber' | 'blue' | 'red' | 'neutral'
export type AuditEvent = { action: string; actor: string; scope: 'private' | 'submitted'; time: string }
export type CandidateDetails = {
  birthYear: string
  phone: string
  email: string
  region: string
  flow: string
  programYear: string
  regionalProgram: string
  regionalProgramYear: string
  appointmentAuthority: string
}
export type PresentedSnapshot = {
  version: number
  corrected: boolean
  candidate: CandidateDetails
  supportFile: string
  housingYear: string
  housingAnswer: string
  documentCount: number
  reply: string
}
export type SignalDecision = {
  status: 'Рассмотрено' | 'Запрошено уточнение' | 'Исключено с обоснованием'
  comment: string
}
export type NavItem = { screen: Screen; title: string; icon: ReactNode }
