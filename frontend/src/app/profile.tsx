import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronRight,
  Download,
  FileText,
  Files,
  LogOut,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  Upload,
  X
} from 'lucide-react'
import { api, ApiError } from './api'
import { Notice, Panel } from './ui'
import { dateText } from './format'

// ---- типы контракта (backend/app/domains/profile) ----

export type Me = { username: string; display_name: string; role: string }

type Person = { full_name: string; birth_year: number | null; phone: string; email: string; current_workplace: string }
type Program = { flow: string; program_year: number | null; region: string; regional_program: string; regional_program_year: number | null }
type ServicePeriod = { id?: string; start_date: string | null; end_date: string | null; kind: string; officer_category: string }
type Relative = { id?: string; full_name: string; degree: string; participant_status: string | null }
type Record_ = {
  id?: string; recipient_kind: string | null; recipient_name: string; recipient_birth_year: number | null
  relation: string; title: string; kind_text: string; basis: string; level: string; form: string
  amount: string | null; period_from: string | null; period_to: string | null; payment_date: string | null
  event_date: string | null; housing_kind: string; document_ref: string; document_id: string | null; extra: Record<string, unknown>
}
type Block = { category: string; answer: string | null; records: Record_[] }
type ActivityRow = { id?: string; organization: string; kind: string; engagement: string; period_from: string | null; period_to: string | null; basis_document: string }
type Doc = { id: string; filename: string; size: number; kind: string; created_at: string }
type Draft = {
  profile_id: string; status: string; progress: number
  person: Person; program: Program
  reserve_act_number: string; reserve_act_date: string | null
  work_status: string | null; appointment_authority: string
  service_periods: ServicePeriod[]
  kinship: { has_relative: boolean | null; received_payments: boolean | null; relatives: Relative[] }
  relatives: Relative[]
  payments: Block[]
  activity_participates: boolean | null
  activities: ActivityRow[]
  documents: Doc[]
  versions_total: number; updated_at: string
}
type Completeness = { progress: number; milestones: { percent: number; title: string; done: boolean }[]; missing: string[]; can_submit: boolean }
type Version = { id: string; number: number; status: string; progress: number; created_at: string }
type Signal = { id: string; rule_id: string; title: string; explanation: string; action: string; status: string; created_at: string }
type Message = { id: string; author_role: string; author_name: string; kind: string; text: string; created_at: string }
type Contact = { id: string; name: string; responsibility: string; phone: string; email: string }
type QueueItem = { profile_id: string; full_name: string; program: string; status: string; progress: number; submitted_at: string | null; pending_signals: number; reviewer_name: string }
type IncomeSummary = {
  currency: string
  total: string
  records: number
  by_category: { category: string; total: string }[]
}
type AuditEvent = { id: string; actor_name: string; actor_role: string; action: string; created_at: string }
type ReviewerProfile = {
  profile_id: string; full_name: string; status: string; pending_signals: number; assigned_reviewer: string
  income_summary: IncomeSummary
  version: Version & { snapshot: Record<string, any> }
  signals: Signal[]; messages: Message[]
  reviews: { id: string; result: string; basis_text: string; comment: string; author_name: string; created_at: string }[]
}

const CATEGORIES: [string, string][] = [
  ['one_time', 'Единовременные выплаты'],
  ['allowance', 'Пособия'],
  ['support', 'Меры социальной поддержки'],
  ['insurance', 'Страховое обеспечение'],
  ['family', 'Выплаты членам семьи'],
  ['material_aid', 'Материальная помощь'],
  ['housing', 'Жилищные меры'],
  ['monetary_allowance', 'Денежное довольствие'],
  ['allowances', 'Надбавки'],
  ['non_monetary', 'Неденежные меры']
]
const ANSWERS: [string, string][] = [['yes', 'Да'], ['no', 'Нет'], ['planned', 'Планируется']]
const DOC_KINDS: [string, string][] = [
  ['diploma', 'Диплом об образовании'], ['reserve_act', 'Акт о зачислении в резерв'],
  ['order', 'Приказ'], ['contract', 'Договор'], ['act', 'Акт'], ['letter', 'Письмо'], ['other', 'Иное']
]
const STATUS_RU: Record<string, string> = {
  draft: 'Личный черновик', submitted: 'Сведения представлены', accepted: 'Принят к рассмотрению',
  clarification: 'Требуется уточнение', resubmitted: 'Представлен повторно',
  completed: 'Рассмотрение завершено', removed: 'Снят с рассмотрения',
  unreviewed: 'Не рассмотрено', reviewed: 'Рассмотрено', dismissed: 'Исключено'
}
const WORK_STATUS: [string, string][] = [
  ['serving', 'Проходит службу'], ['outside', 'Вне службы'], ['reserve', 'В запасе'], ['retired', 'В отставке']
]
const EDITABLE = ['draft', 'clarification']
const status = (s: string) => STATUS_RU[s] || s

function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function Shell({ me, onLogout, children }: { me: Me; onLogout: () => void; children: React.ReactNode }) {
  return (
    <div className="app">
      <div className="workspace" style={{ marginLeft: 0 }}>
        <header className="topbar">
          <span>
            Рабочее пространство <ChevronRight size={14} />{' '}
            <b>{me.role === 'reservist' ? 'Финансовый профиль' : 'Проверка профилей'}</b>
          </span>
          <div>
            <span className="synthetic-tag">Синтетические данные</span>
            <div className="avatar">{(me.display_name || me.username).slice(0, 2).toUpperCase()}</div>
            <div className="user">
              <b>{me.display_name || me.username}</b>
              <small>{me.role === 'reservist' ? 'Резервист' : 'Проверяющий'} · учебный аккаунт</small>
            </div>
            <button className="icon-button" aria-label="Выйти" onClick={onLogout}>
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  )
}

// ============================== РЕЗЕРВИСТ ==============================

function ReservistView({ toast }: { toast: (m: string) => void }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [comp, setComp] = useState<Completeness | null>(null)
  const [versions, setVersions] = useState<Version[]>([])
  const [signals, setSignals] = useState<Signal[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [error, setError] = useState('')
  const [reply, setReply] = useState('')
  const [docKind, setDocKind] = useState('diploma')

  const editable = !!draft && EDITABLE.includes(draft.status)
  const load = async () => {
    const [d, c, v, s, ms, ct, au] = await Promise.all([
      api<Draft>('/profile'),
      api<Completeness>('/profile/completeness'),
      api<Version[]>('/profile/versions'),
      api<Signal[]>('/profile/signals'),
      api<Message[]>('/profile/messages'),
      api<Contact[]>('/reference/contacts'),
      api<AuditEvent[]>('/profile/audit')
    ])
    setDraft(d); setComp(c); setVersions(v); setSignals(s); setMessages(ms); setContacts(ct); setAudit(au)
  }
  useEffect(() => { load().catch((e) => setError(e.message)) }, [])

  const run = (fn: () => Promise<void>, ok = '') =>
    fn()
      .then(async () => { await load(); if (ok) toast(ok) })
      .catch((e) => setError(e.message))

  const upd = (fn: (d: Draft) => void) => setDraft((d) => { if (!d) return d; const c = { ...d }; fn(c); return c })
  const setPerson = (k: keyof Person, v: string | number | null) => upd((d) => { d.person = { ...d.person, [k]: v } })
  const setProgram = (k: keyof Program, v: string | number | null) => upd((d) => { d.program = { ...d.program, [k]: v } })
  const setList = <T,>(key: 'service_periods' | 'activities', fn: (rows: T[]) => T[]) =>
    upd((d) => { (d[key] as T[]) = fn(d[key] as T[]) })
  const setBlock = (cat: string, fn: (b: Block) => void) =>
    upd((d) => { const b = d.payments.find((x) => x.category === cat); if (b) fn(b) })

  if (!draft) return error ? <Notice warning>{error}</Notice> : <Panel><div className="empty"><p>Загрузка профиля…</p></div></Panel>

  const submitPayload = () => ({
    person: draft.person, program: draft.program,
    reserve_act_number: draft.reserve_act_number, reserve_act_date: draft.reserve_act_date,
    work_status: draft.work_status, appointment_authority: draft.appointment_authority,
    service_periods: draft.service_periods.map(({ id: _id, ...r }) => r),
    kinship: { ...draft.kinship, relatives: draft.relatives.map(({ id: _id, ...r }) => r) },
    payments: draft.payments.map((b) => ({ ...b, records: b.records.map(({ id: _id, ...r }) => r) })),
    activity_participates: draft.activity_participates,
    activities: draft.activities.map(({ id: _id, ...r }) => r)
  })

  return (
    <>
      {error && <Notice warning>{error}</Notice>}
      <div className="page-heading">
        <div>
          <div className="eyebrow">ФИНАНСОВЫЙ ПРОФИЛЬ · {status(draft.status).toUpperCase()}</div>
          <h1>{draft.person.full_name || 'Новый профиль'}</h1>
          <p>{draft.program.regional_program || draft.program.flow || 'Заполните сведения о потоке'}</p>
        </div>
        <div className="actions">
          {editable && (
            <button onClick={() => run(() => api('/profile', { method: 'PUT', body: JSON.stringify(submitPayload()) }).then(() => {}), 'Черновик сохранён')}>
              <Check size={16} /> Сохранить черновик
            </button>
          )}
          {editable && comp?.can_submit && (
            <button className="secondary" onClick={() => run(() => api('/profile/submit', { method: 'POST' }).then(() => {}), 'Сведения представлены')}>
              <Send size={16} /> Представить сведения
            </button>
          )}
        </div>
      </div>

      {comp && (
        <Panel title={`Заполнение: ${comp.progress}%`}>
          <div className="steps">
            {comp.milestones.map((mstone) => (
              <div key={mstone.percent} className={`stat ${mstone.done ? '' : 'amber'}`}>
                <b>{mstone.percent}%</b>
                <span>{mstone.title}</span>
              </div>
            ))}
          </div>
          {!!comp.missing.length && editable && (
            <Notice warning>
              <ul>{comp.missing.map((x) => <li key={x}>{x}</li>)}</ul>
            </Notice>
          )}
        </Panel>
      )}

      <Panel title="Анкета и поток">
        <div className="form-row">
          <label>ФИО<input disabled={!editable} value={draft.person.full_name} onChange={(e) => setPerson('full_name', e.target.value)} /></label>
          <label>Год рождения<input disabled={!editable} type="number" value={draft.person.birth_year ?? ''} onChange={(e) => setPerson('birth_year', e.target.value ? +e.target.value : null)} /></label>
        </div>
        <div className="form-row">
          <label>Телефон<input disabled={!editable} value={draft.person.phone} onChange={(e) => setPerson('phone', e.target.value)} /></label>
          <label>E-mail<input disabled={!editable} value={draft.person.email} onChange={(e) => setPerson('email', e.target.value)} /></label>
        </div>
        <label>Текущее место работы<input disabled={!editable} value={draft.person.current_workplace} onChange={(e) => setPerson('current_workplace', e.target.value)} /></label>
        <div className="form-row">
          <label>Поток<input disabled={!editable} value={draft.program.flow} onChange={(e) => setProgram('flow', e.target.value)} placeholder="Время героев" /></label>
          <label>Год программы<input disabled={!editable} type="number" value={draft.program.program_year ?? ''} onChange={(e) => setProgram('program_year', e.target.value ? +e.target.value : null)} /></label>
        </div>
        <div className="form-row">
          <label>Регион<input disabled={!editable} value={draft.program.region} onChange={(e) => setProgram('region', e.target.value)} /></label>
          <label>Региональная программа<input disabled={!editable} value={draft.program.regional_program} onChange={(e) => setProgram('regional_program', e.target.value)} placeholder="Герои Липецкой земли" /></label>
        </div>
        <div className="form-row">
          <label>Акт о зачислении №<input disabled={!editable} value={draft.reserve_act_number} onChange={(e) => upd((d) => { d.reserve_act_number = e.target.value })} /></label>
          <label>Дата акта<input disabled={!editable} type="date" value={draft.reserve_act_date || ''} onChange={(e) => upd((d) => { d.reserve_act_date = e.target.value || null })} /></label>
        </div>
        <div className="form-row">
          <label>Статус службы
            <select disabled={!editable} value={draft.work_status || ''} onChange={(e) => upd((d) => { d.work_status = e.target.value || null })}>
              <option value="">— выберите —</option>
              {WORK_STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label>Предполагаемый орган назначения<input disabled={!editable} value={draft.appointment_authority} onChange={(e) => upd((d) => { d.appointment_authority = e.target.value })} /></label>
        </div>
      </Panel>

      <Panel title="Периоды службы" action={editable && <button className="secondary" onClick={() => setList<ServicePeriod>('service_periods', (r) => [...r, { start_date: null, end_date: null, kind: 'military', officer_category: '' }])}><Plus size={15} /> Добавить</button>}>
        {!draft.service_periods.length && <p className="muted">Периоды не добавлены.</p>}
        {draft.service_periods.map((s, i) => (
          <div className="form-row" key={i}>
            <label>Начало<input disabled={!editable} type="date" value={s.start_date || ''} onChange={(e) => setList<ServicePeriod>('service_periods', (r) => r.map((x, j) => j === i ? { ...x, start_date: e.target.value || null } : x))} /></label>
            <label>Окончание<input disabled={!editable} type="date" value={s.end_date || ''} onChange={(e) => setList<ServicePeriod>('service_periods', (r) => r.map((x, j) => j === i ? { ...x, end_date: e.target.value || null } : x))} /></label>
            <label>Вид<input disabled={!editable} value={s.kind} onChange={(e) => setList<ServicePeriod>('service_periods', (r) => r.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))} /></label>
            {editable && <button className="icon-button" aria-label="Удалить" onClick={() => setList<ServicePeriod>('service_periods', (r) => r.filter((_, j) => j !== i))}><Trash2 size={15} /></button>}
          </div>
        ))}
      </Panel>

      <Panel title="Родство с участником СВО">
        <div className="form-row">
          <label>Есть родственник — участник СВО?
            <select disabled={!editable} value={draft.kinship.has_relative === null ? '' : String(draft.kinship.has_relative)} onChange={(e) => upd((d) => { d.kinship = { ...d.kinship, has_relative: e.target.value === '' ? null : e.target.value === 'true' } })}>
              <option value="">—</option><option value="true">Да</option><option value="false">Нет</option>
            </select>
          </label>
          <label>Получали ли выплаты родственники?
            <select disabled={!editable} value={draft.kinship.received_payments === null ? '' : String(draft.kinship.received_payments)} onChange={(e) => upd((d) => { d.kinship = { ...d.kinship, received_payments: e.target.value === '' ? null : e.target.value === 'true' } })}>
              <option value="">—</option><option value="true">Да</option><option value="false">Нет</option>
            </select>
          </label>
        </div>
        {draft.kinship.has_relative && draft.relatives.map((r, i) => (
          <div className="form-row" key={i}>
            <label>ФИО<input disabled={!editable} value={r.full_name} onChange={(e) => upd((d) => { d.relatives = d.relatives.map((x, j) => j === i ? { ...x, full_name: e.target.value } : x) })} /></label>
            <label>Степень родства
              <select disabled={!editable} value={r.degree} onChange={(e) => upd((d) => { d.relatives = d.relatives.map((x, j) => j === i ? { ...x, degree: e.target.value } : x) })}>
                <option value="">—</option><option value="spouse">Супруг(а)</option><option value="child">Ребёнок</option><option value="parent">Родитель</option><option value="other">Иное</option>
              </select>
            </label>
            <label>Статус
              <select disabled={!editable} value={r.participant_status || ''} onChange={(e) => upd((d) => { d.relatives = d.relatives.map((x, j) => j === i ? { ...x, participant_status: e.target.value || null } : x) })}>
                <option value="">—</option><option value="participating">Участвует</option><option value="participated">Участвовал</option><option value="deceased">Погиб</option><option value="missing">Пропал без вести</option>
              </select>
            </label>
            {editable && <button className="icon-button" aria-label="Удалить" onClick={() => upd((d) => { d.relatives = d.relatives.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>}
          </div>
        ))}
        {editable && draft.kinship.has_relative && (
          <button className="secondary" onClick={() => upd((d) => { d.relatives = [...d.relatives, { full_name: '', degree: '', participant_status: null }] })}><Plus size={15} /> Добавить родственника</button>
        )}
      </Panel>

      <Panel title="Выплаты и меры поддержки">
        {draft.payments.map((b) => (
          <div key={b.category} className="panel" style={{ marginBottom: 12 }}>
            <div className="panel-body">
              <div className="form-row" style={{ alignItems: 'center' }}>
                <b style={{ flex: 1 }}>{CATEGORIES.find(([c]) => c === b.category)?.[1] || b.category}</b>
                <select disabled={!editable} value={b.answer || ''} onChange={(e) => setBlock(b.category, (x) => { x.answer = e.target.value || null })}>
                  <option value="">— ответ —</option>
                  {ANSWERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {editable && (b.answer === 'yes' || b.answer === 'planned') && (
                  <button className="secondary" onClick={() => setBlock(b.category, (x) => { x.records = [...x.records, { recipient_kind: 'candidate', recipient_name: '', recipient_birth_year: null, relation: '', title: '', kind_text: '', basis: '', level: '', form: '', amount: null, period_from: null, period_to: null, payment_date: null, event_date: null, housing_kind: '', document_ref: '', document_id: null, extra: {} }] })}><Plus size={14} /> Запись</button>
                )}
              </div>
              {b.records.map((r, i) => (
                <div key={i} style={{ borderTop: '1px solid var(--line, #e2e8f0)', paddingTop: 8, marginTop: 8 }}>
                  <div className="form-row">
                    <label>Наименование<input disabled={!editable} value={r.title} onChange={(e) => setBlock(b.category, (x) => { x.records[i].title = e.target.value })} /></label>
                    <label>Основание / НПА<input disabled={!editable} value={r.basis} onChange={(e) => setBlock(b.category, (x) => { x.records[i].basis = e.target.value })} /></label>
                  </div>
                  <div className="form-row">
                    <label>Период с<input disabled={!editable} type="date" value={r.period_from || ''} onChange={(e) => setBlock(b.category, (x) => { x.records[i].period_from = e.target.value || null })} /></label>
                    <label>по<input disabled={!editable} type="date" value={r.period_to || ''} onChange={(e) => setBlock(b.category, (x) => { x.records[i].period_to = e.target.value || null })} /></label>
                    <label>Сумма<input disabled={!editable} value={r.amount || ''} onChange={(e) => setBlock(b.category, (x) => { x.records[i].amount = e.target.value || null })} /></label>
                    <label>Форма
                      <select disabled={!editable} value={r.form} onChange={(e) => setBlock(b.category, (x) => { x.records[i].form = e.target.value })}>
                        <option value="">—</option><option value="monetary">Денежная</option><option value="in_kind">Неденежная</option>
                      </select>
                    </label>
                  </div>
                  <div className="form-row">
                    <label>Документ-основание<input disabled={!editable} value={r.document_ref} onChange={(e) => setBlock(b.category, (x) => { x.records[i].document_ref = e.target.value })} placeholder="Реквизиты документа" /></label>
                    {b.category === 'housing' && (
                      <label>Вид меры
                        <select disabled={!editable} value={r.housing_kind} onChange={(e) => setBlock(b.category, (x) => { x.records[i].housing_kind = e.target.value })}>
                          <option value="">—</option><option value="subsidy">Субсидия</option><option value="compensation">Компенсация</option><option value="property">Имущество</option><option value="credit">Кредит</option>
                        </select>
                      </label>
                    )}
                    <label>Получатель
                      <select disabled={!editable} value={r.recipient_kind || ''} onChange={(e) => setBlock(b.category, (x) => { x.records[i].recipient_kind = e.target.value || null })}>
                        <option value="">—</option><option value="candidate">Кандидат</option><option value="family_member">Член семьи</option><option value="relative_participant">Родственник — участник СВО</option>
                      </select>
                    </label>
                    {editable && <button className="icon-button" aria-label="Удалить" onClick={() => setBlock(b.category, (x) => { x.records = x.records.filter((_, j) => j !== i) })}><Trash2 size={15} /></button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Panel>

      <Panel title="Дополнительная деятельность">
        <label>Участвуете в преподавательской, экспертной или иной деятельности?
          <select disabled={!editable} value={draft.activity_participates === null ? '' : String(draft.activity_participates)} onChange={(e) => upd((d) => { d.activity_participates = e.target.value === '' ? null : e.target.value === 'true' })}>
            <option value="">—</option><option value="true">Да</option><option value="false">Нет</option>
          </select>
        </label>
        {draft.activity_participates && draft.activities.map((a, i) => (
          <div className="form-row" key={i}>
            <label>Организация<input disabled={!editable} value={a.organization} onChange={(e) => setList<ActivityRow>('activities', (r) => r.map((x, j) => j === i ? { ...x, organization: e.target.value } : x))} /></label>
            <label>Вид
              <select disabled={!editable} value={a.kind} onChange={(e) => setList<ActivityRow>('activities', (r) => r.map((x, j) => j === i ? { ...x, kind: e.target.value } : x))}>
                <option value="">—</option><option value="teaching">Преподавание</option><option value="expertise">Экспертиза</option><option value="consulting">Консультирование</option><option value="commission">Комиссии</option><option value="other">Иное</option>
              </select>
            </label>
            <label>Период с<input disabled={!editable} type="date" value={a.period_from || ''} onChange={(e) => setList<ActivityRow>('activities', (r) => r.map((x, j) => j === i ? { ...x, period_from: e.target.value || null } : x))} /></label>
            <label>по<input disabled={!editable} type="date" value={a.period_to || ''} onChange={(e) => setList<ActivityRow>('activities', (r) => r.map((x, j) => j === i ? { ...x, period_to: e.target.value || null } : x))} /></label>
            {editable && <button className="icon-button" aria-label="Удалить" onClick={() => setList<ActivityRow>('activities', (r) => r.filter((_, j) => j !== i))}><Trash2 size={15} /></button>}
          </div>
        ))}
        {editable && draft.activity_participates && (
          <button className="secondary" onClick={() => setList<ActivityRow>('activities', (r) => [...r, { organization: '', kind: '', engagement: '', period_from: null, period_to: null, basis_document: '' }])}><Plus size={15} /> Добавить</button>
        )}
      </Panel>

      <Panel title="Документы" action={editable && (
        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={docKind} onChange={(e) => setDocKind(e.target.value)}>
            {DOC_KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="secondary button-file">
            <Upload size={15} /> Загрузить
            <input type="file" style={{ display: 'none' }} accept=".json,.xlsx,.pdf,.docx" onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const body = new FormData()
              body.append('file', f)
              body.append('kind', docKind)
              run(() => api('/profile/documents', { method: 'POST', body }).then(() => {}), 'Документ загружен')
              e.target.value = ''
            }} />
          </span>
        </label>
      )}>
        {!draft.documents.length && <p className="muted">Документы не загружены.</p>}
        {draft.documents.map((d) => (
          <div key={d.id} className="document">
            <FileText size={16} />
            <span style={{ flex: 1 }}>{d.filename} <small className="muted">· {DOC_KINDS.find(([k]) => k === d.kind)?.[1] || d.kind}</small></span>
            {editable && <button className="icon-button" aria-label="Удалить" onClick={() => run(() => api(`/profile/documents/${d.id}`, { method: 'DELETE' }).then(() => {}))}><Trash2 size={15} /></button>}
          </div>
        ))}
      </Panel>

      {!!versions.length && (
        <Panel title="Версии представления">
          {versions.map((v) => (
            <div key={v.id} className="document">
              <Files size={16} />
              <span style={{ flex: 1 }}>Версия {v.number} · {status(v.status)} · {dateText(v.created_at)}</span>
            </div>
          ))}
        </Panel>
      )}

      {!!signals.length && (
        <Panel title="Несоответствия по представленным сведениям">
          <Notice>Несоответствие — повод для уточнения, а не вывод о нарушении. Решения принимает проверяющий.</Notice>
          {signals.map((s) => (
            <div key={s.id} className="signal-card">
              <b>{s.title}</b>
              <p>{s.explanation}</p>
              <p className="muted">Что сделать: {s.action}</p>
              <span className={`badge ${s.status}`}>{status(s.status)}</span>
            </div>
          ))}
        </Panel>
      )}

      {!!versions.length && (
        <Panel title="Переписка с проверяющим">
          {messages.map((m) => (
            <div key={m.id} className="document">
              <MessageSquare size={16} />
              <div style={{ flex: 1 }}>
                <b>{m.author_name}</b> <small className="muted">{dateText(m.created_at)}</small>
                <p>{m.text}</p>
              </div>
            </div>
          ))}
          {draft.status !== 'completed' && draft.status !== 'removed' && (
            <div className="form-row" style={{ alignItems: 'end' }}>
              <label style={{ flex: 1 }}>Ответ<input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Ответ на вопросы проверяющего" /></label>
              <button className="secondary" disabled={!reply.trim()} onClick={() => run(() => api('/profile/messages', { method: 'POST', body: JSON.stringify({ text: reply }) }).then(() => { setReply('') }))}><Send size={15} /> Отправить</button>
            </div>
          )}
        </Panel>
      )}

      {!!contacts.length && (
        <Panel title="Ответственные операторы">
          {contacts.map((c) => (
            <div key={c.id} className="document">
              <span style={{ flex: 1 }}><b>{c.name}</b> — {c.responsibility}</span>
              <span className="muted">{c.phone} · {c.email}</span>
            </div>
          ))}
        </Panel>
      )}

      {!!audit.length && (
        <Panel title="Журнал действий">
          {audit.map((a) => (
            <div key={a.id} className="document">
              <span style={{ flex: 1 }}><b>{a.action}</b> <small className="muted">· {a.actor_name}</small></span>
              <span className="muted">{dateText(a.created_at)}</span>
            </div>
          ))}
        </Panel>
      )}
    </>
  )
}

// ============================== ПРОВЕРЯЮЩИЙ ==============================

function ReviewerView({ toast }: { toast: (m: string) => void }) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [filter, setFilter] = useState('')
  const [card, setCard] = useState<ReviewerProfile | null>(null)
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [error, setError] = useState('')
  const [comment, setComment] = useState('')
  const [basis, setBasis] = useState('')
  const [question, setQuestion] = useState('')
  const [signalComments, setSignalComments] = useState<Record<string, string>>({})

  const loadQueue = async () => setQueue(await api<QueueItem[]>(`/reviewer/queue${filter ? `?status=${filter}` : ''}`))
  const loadCard = async (id: string) => {
    setCard(await api<ReviewerProfile>(`/reviewer/profiles/${id}`))
    setAudit(await api<AuditEvent[]>(`/reviewer/profiles/${id}/audit`))
  }
  useEffect(() => { loadQueue().catch((e) => setError(e.message)) }, [filter])
  const run = (fn: () => Promise<void>, ok = '') =>
    fn().then(async () => {
      await loadQueue()
      if (card) await loadCard(card.profile_id)
      if (ok) toast(ok)
    }).catch((e) => setError(e.message))

  const snapshot = card?.version.snapshot
  const decide = (action: string) =>
    run(() => api(`/reviewer/profiles/${card!.profile_id}/decision`, {
      method: 'POST', body: JSON.stringify({ action, comment, basis })
    }).then(() => { setComment(''); setBasis('') }), 'Решение зафиксировано')

  if (card && snapshot) {
    const snap = snapshot as any
    const final = card.status === 'completed' || card.status === 'removed'
    return (
      <>
        {error && <Notice warning>{error}</Notice>}
        <div className="page-heading">
          <div>
            <div className="eyebrow">ПРОФИЛЬ · {status(card.status).toUpperCase()} · ВЕРСИЯ {card.version.number}</div>
            <h1>{card.full_name}</h1>
            <p>{snap.program?.regional_program || snap.program?.flow} · назначен: {card.assigned_reviewer || '—'}</p>
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => setCard(null)}><X size={16} /> К очереди</button>
            <button className="secondary" onClick={() => run(async () => { const data = await api(`/reviewer/profiles/${card.profile_id}/export`); downloadJson(data, `profile-${card.version.number}.json`) })}><Download size={16} /> JSON</button>
          </div>
        </div>

        <Panel title="Представленные сведения (слепок версии)">
          <div className="info-grid">
            <div><small>ФИО</small><b>{snap.person?.full_name}</b></div>
            <div><small>Год рождения</small><b>{snap.person?.birth_year}</b></div>
            <div><small>Телефон</small><b>{snap.person?.phone}</b></div>
            <div><small>Регион / поток</small><b>{snap.program?.region} · {snap.program?.flow} {snap.program?.program_year}</b></div>
            <div><small>Акт о зачислении</small><b>{snap.reserve_act_number} от {snap.reserve_act_date}</b></div>
            <div><small>Орган назначения</small><b>{snap.appointment_authority || '—'}</b></div>
          </div>
          <p><b>Служба:</b> {(snap.service_periods || []).map((p: any) => `${p.start_date} — ${p.end_date || 'н.в.'} (${p.kind})`).join('; ') || '—'}</p>
          <p><b>Родство СВО:</b> {snap.kinship?.has_relative ? `да (${(snap.kinship.relatives || []).map((r: any) => r.full_name).join(', ')})` : 'нет'}{snap.kinship?.received_payments ? ' · выплаты получали' : ''}</p>
          <p><b>Доп. деятельность:</b> {snap.activity_participates ? (snap.activities || []).map((a: any) => `${a.organization} (${a.kind}, ${a.period_from} — ${a.period_to || 'н.в.'})`).join('; ') || 'да' : 'нет'}</p>
          <p><b>Документы:</b> {(snap.documents || []).map((d: any) => d.filename).join(', ') || '—'}</p>
          {(snap.payments || []).filter((b: any) => b.answer && b.answer !== 'no').map((b: any) => (
            <div key={b.category} style={{ marginTop: 8 }}>
              <b>{CATEGORIES.find(([c]) => c === b.category)?.[1] || b.category} — {b.answer === 'planned' ? 'планируется' : 'да'}</b>
              {(b.records || []).map((r: any, i: number) => (
                <p key={i} className="muted" style={{ marginLeft: 12 }}>
                  {r.title || 'запись'} · {r.basis || 'без основания'} · {r.period_from} — {r.period_to || 'н.в.'}
                  {r.amount ? ` · ${r.amount}` : ''}{r.housing_kind ? ` · ${r.housing_kind}` : ''} · документ: {r.document_ref || 'нет'}
                </p>
              ))}
            </div>
          ))}
        </Panel>

        <Panel title="Сведения о доходах">
          <div className="info-grid">
            <div><small>Денежные поступления</small><b>{card.income_summary?.total ?? '0.00'} {card.income_summary?.currency || 'RUB'}</b></div>
            <div><small>Записей в сумме</small><b>{card.income_summary?.records ?? 0}</b></div>
          </div>
          {!!card.income_summary?.by_category.length && (
            <table>
              <thead><tr><th>Категория</th><th>Сумма</th></tr></thead>
              <tbody>
                {card.income_summary.by_category.map((c) => (
                  <tr key={c.category}>
                    <td>{CATEGORIES.find(([k]) => k === c.category)?.[1] || c.category}</td>
                    <td>{c.total} {card.income_summary.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted">Учитываются только денежные выплаты; неденежные меры и выплаты «в натуре» в сумму не входят.</p>
        </Panel>

        <Panel title={`Несоответствия (${card.pending_signals} новых)`}>
          {!card.signals.length && <p className="muted">Несоответствий нет — детерминированные проверки пройдены.</p>}
          {card.signals.map((s) => (
            <div key={s.id} className="signal-card">
              <b>{s.title}</b> <span className={`badge ${s.status}`}>{status(s.status)}</span>
              <p>{s.explanation}</p>
              <p className="muted">Действие: {s.action}</p>
              {!final && (
                <div className="form-row" style={{ alignItems: 'end' }}>
                  <label style={{ flex: 1 }}>Комментарий<input value={signalComments[s.id] || ''} onChange={(e) => setSignalComments((p) => ({ ...p, [s.id]: e.target.value }))} placeholder="≥ 5 символов" /></label>
                  {(['reviewed', 'clarification', 'dismissed'] as const).map((st) => (
                    <button key={st} className="secondary" disabled={(signalComments[s.id] || '').trim().length < 5}
                      onClick={() => run(() => api(`/reviewer/signals/${s.id}/decision`, { method: 'POST', body: JSON.stringify({ status: st, comment: signalComments[s.id] }) }).then(() => {}))}>
                      {status(st)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Panel>

        {!final && (
          <Panel title="Решение по профилю">
            <label>Комментарий (обязателен, ≥ 5 символов)<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} /></label>
            <label>Основание (обязательно при снятии с рассмотрения)<input value={basis} onChange={(e) => setBasis(e.target.value)} placeholder="Реквизиты документа-основания" /></label>
            <div className="actions">
              <button className="secondary" disabled={comment.trim().length < 5} onClick={() => decide('accept')}>Принять к рассмотрению</button>
              <button className="secondary" disabled={comment.trim().length < 5} onClick={() => decide('clarification')}>Требуются уточнения</button>
              <button disabled={comment.trim().length < 5} onClick={() => decide('complete')}>Завершить рассмотрение</button>
              <button className="secondary" disabled={comment.trim().length < 5 || !basis.trim()} onClick={() => decide('remove')}>Снять с рассмотрения</button>
            </div>
          </Panel>
        )}

        {!!card.reviews.length && (
          <Panel title="Решения">
            {card.reviews.map((r) => (
              <div key={r.id} className="document">
                <span style={{ flex: 1 }}><b>{status(r.result)}</b> · {r.comment} · основание: {r.basis_text || '—'}</span>
                <span className="muted">{r.author_name} · {dateText(r.created_at)}</span>
              </div>
            ))}
          </Panel>
        )}

        <Panel title="Переписка">
          {card.messages.map((m) => (
            <div key={m.id} className="document">
              <MessageSquare size={16} />
              <div style={{ flex: 1 }}><b>{m.author_name}</b> <small className="muted">{dateText(m.created_at)}</small><p>{m.text}</p></div>
            </div>
          ))}
          {!final && (
            <div className="form-row" style={{ alignItems: 'end' }}>
              <label style={{ flex: 1 }}>Вопрос резервисту<input value={question} onChange={(e) => setQuestion(e.target.value)} /></label>
              <button className="secondary" disabled={!question.trim()} onClick={() => run(() => api(`/reviewer/profiles/${card.profile_id}/messages`, { method: 'POST', body: JSON.stringify({ text: question }) }).then(() => { setQuestion('') }))}><Send size={15} /> Спросить</button>
            </div>
          )}
        </Panel>

        {!!audit.length && (
          <Panel title="Журнал рассмотрения">
            {audit.map((a) => (
              <div key={a.id} className="document">
                <span style={{ flex: 1 }}><b>{a.action}</b> <small className="muted">· {a.actor_name}</small></span>
                <span className="muted">{dateText(a.created_at)}</span>
              </div>
            ))}
          </Panel>
        )}
      </>
    )
  }

  return (
    <>
      {error && <Notice warning>{error}</Notice>}
      <div className="page-heading">
        <div>
          <div className="eyebrow">ОЧЕРЕДЬ МАТЕРИАЛОВ</div>
          <h1>Профили на проверке</h1>
          <p>Опубликованные сведения резервистов. Личные черновики в очередь не попадают.</p>
        </div>
        <div className="actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Все статусы</option>
            {['submitted', 'accepted', 'clarification', 'resubmitted', 'completed', 'removed'].map((s) => <option key={s} value={s}>{status(s)}</option>)}
          </select>
        </div>
      </div>
      <Panel>
        {!queue.length && <div className="empty"><p>Очередь пуста.</p></div>}
        {queue.map((q) => (
          <div key={q.profile_id} className="document" role="button" onClick={() => run(() => loadCard(q.profile_id))} style={{ cursor: 'pointer' }}>
            <div style={{ flex: 1 }}>
              <b>{q.full_name}</b>
              <p className="muted">{q.program || '—'} · {q.progress}% · {q.submitted_at ? dateText(q.submitted_at) : '—'} · проверяющий: {q.reviewer_name || '—'}</p>
            </div>
            {!!q.pending_signals && <em className="badge amber">{q.pending_signals} несоотв.</em>}
            <span className={`badge ${q.status}`}>{status(q.status)}</span>
          </div>
        ))}
      </Panel>
    </>
  )
}

export function ProfileApp({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const [toast, setToast] = useState('')
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 4000)
    return () => clearTimeout(t)
  }, [toast])
  return (
    <Shell me={me} onLogout={onLogout}>
      {toast && <div className="toast" role="status"><Check size={18} />{toast}<button className="icon-button" onClick={() => setToast('')} aria-label="Закрыть"><X size={16} /></button></div>}
      {me.role === 'reservist' ? <ReservistView toast={setToast} /> : <ReviewerView toast={setToast} />}
      <p className="page-footnote">Демонстрационный прототип команды «Резонанс». Только вымышленные данные. Решение принимает уполномоченный человек.</p>
    </Shell>
  )
}
