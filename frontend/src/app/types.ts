export type View =
  | 'overview'
  | 'checks'
  | 'new'
  | 'case'
  | 'documents'
  | 'analysis'
  | 'evidence'
  | 'report'
  | 'rules'
export interface CaseSummary {
  id: string
  number: string
  name: string
  department: string
  basis: string
  year: number
  created_at: string
  signals_count: number
  pending_count: number
  status: string
  stale: boolean
}
export interface Fact {
  id: string
  document_id: string
  document_name: string
  field: string
  label: string
  value: string
  object_id: string
  date: string | null
  unit: string
  snippet: string
  confirmed: boolean
}
export interface Decision {
  id: string
  status: string
  comment: string
  created_at: string
  author: string
}
export interface Signal {
  id: string
  run_id: string
  rule: string
  title: string
  explanation: string
  action: string
  evidence: Fact[]
  status: string
  decisions: Decision[]
}
export interface Run {
  id: string
  created_at: string
  rule_version: string
  enabled_rules: string[]
  input_hash: string
  warnings: string[]
  signals: Signal[]
}
export interface CaseDetail extends CaseSummary {
  facts: Fact[]
  documents: {
    id: string
    name: string
    sha256: string
    status: string
    error: string | null
    downloadable: boolean
  }[]
  runs: Run[]
  events: { id: string; message: string; created_at: string; author: string }[]
}
export interface Rule {
  id: string
  title: string
  description: string
}
