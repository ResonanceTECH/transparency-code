import type { CSSProperties, ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Info,
  Landmark,
  Mail,
  Paperclip,
  Phone,
  ShieldCheck,
  Upload,
  AlertCircle
} from 'lucide-react'
import type { Tone, CandidateDetails } from './types'
import { person, profileId } from './data'

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return <span className={`fp-badge fp-badge-${tone}`}>{children}</span>
}
export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`fp-panel ${className}`}>{children}</section>
}
export function PanelTitle({
  title,
  subtitle,
  action,
  eyebrow
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  eyebrow?: string
}) {
  return (
    <div className="fp-panel-heading">
      <div>
        {eyebrow && <span className="fp-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
export function Notice({
  children,
  tone = 'blue',
  icon
}: {
  children: ReactNode
  tone?: Tone
  icon?: ReactNode
}) {
  return (
    <div className={`fp-notice fp-notice-${tone}`}>
      {icon || <Info size={19} />}
      <div>{children}</div>
    </div>
  )
}
export function Field({
  label,
  value = '',
  options,
  required = false,
  optional = false,
  error,
  hint,
  wide = false,
  onChange,
  type = 'text'
}: {
  label: string
  value?: string
  options?: string[]
  required?: boolean
  optional?: boolean
  error?: string
  hint?: string
  wide?: boolean
  onChange?: (value: string) => void
  type?: string
}) {
  return (
    <label className={`fp-field ${wide ? 'fp-field-wide' : ''} ${error ? 'fp-field-error' : ''}`}>
      <span className="fp-field-label">
        {label}
        {required && <em aria-hidden="true"> *</em>}
        {optional && <small>Необязательно</small>}
      </span>
      {options ? (
        <select
          aria-label={label}
          {...(onChange ? { value } : { defaultValue: value })}
          onChange={(e) => onChange?.(e.target.value)}
        >
          {options.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      ) : onChange ? (
        <input
          aria-label={label}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
        />
      ) : (
        <input aria-label={label} type={type} defaultValue={value} />
      )}
      {error && (
        <span className="fp-field-feedback">
          <AlertCircle size={13} />
          {error}
        </span>
      )}
      {hint && !error && <small className="fp-field-hint">{hint}</small>}
    </label>
  )
}
export function Choice({
  value,
  onChange,
  planned = false
}: {
  value: string
  onChange?: (value: string) => void
  planned?: boolean
}) {
  return (
    <div className="fp-choice" role="group" aria-label="Ответ на вопрос">
      {(planned ? ['Да', 'Планируется', 'Нет'] : ['Да', 'Нет']).map((answer) => (
        <button
          key={answer}
          type="button"
          aria-pressed={answer === value}
          className={answer === value ? 'active' : ''}
          onClick={() => onChange?.(answer)}
        >
          {answer === value && <Check size={14} />}
          {answer}
        </button>
      ))}
    </div>
  )
}
export function FileRow({
  name,
  note = 'Учебный документ · PDF',
  required = false,
  onPreview
}: {
  name: string
  note?: string
  required?: boolean
  onPreview?: (name: string) => void
}) {
  return (
    <div className="fp-file">
      <span className="fp-file-icon">
        <FileText size={21} />
      </span>
      <div>
        <strong>{name}</strong>
        <small>
          {note}
          {required && ' · обязательное основание'}
        </small>
      </div>
      <Badge tone="teal">
        <Check size={13} />
        Добавлен
      </Badge>
      {onPreview && (
        <button className="fp-icon-button" aria-label={`Просмотреть ${name}`} onClick={() => onPreview(name)}>
          <ChevronRight size={17} />
        </button>
      )}
    </div>
  )
}
export function UploadBox({
  label,
  error,
  optional = false,
  onUpload
}: {
  label: string
  error?: boolean
  optional?: boolean
  onUpload?: (name: string) => void
}) {
  return (
    <label className={`fp-upload ${error ? 'fp-upload-error' : ''}`}>
      <span className="fp-upload-icon">
        <Upload size={22} />
      </span>
      <div>
        <strong>{label}</strong>
        <small>
          {optional ? 'При наличии · не блокирует отправку' : 'НПА, решение, договор или справка органа'} ·
          PDF, DOCX
        </small>
        {error && <span className="fp-field-feedback">Прикрепите документ-основание</span>}
      </div>
      <span className="fp-button fp-button-outline">
        <Paperclip size={15} />
        Выбрать файл
      </span>
      <input
        type="file"
        aria-label={label}
        accept=".pdf,.doc,.docx"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onUpload?.(file.name)
        }}
      />
    </label>
  )
}
export function Ring({ value }: { value: number }) {
  return (
    <div
      className="fp-ring"
      role="progressbar"
      aria-label="Заполнение профиля"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      style={{ '--progress': `${value * 3.6}deg` } as CSSProperties}
    >
      <div>
        <strong>
          {value}
          <small>%</small>
        </strong>
        <span>заполнено</span>
      </div>
    </div>
  )
}
export function PersonHeader({
  status,
  tone,
  version,
  details,
  children,
  progress
}: {
  status: string
  tone: Tone
  version: string
  details: CandidateDetails
  children?: ReactNode
  progress?: number
}) {
  return (
    <Panel className="fp-person-header">
      <div className="fp-person-identity">
        <div className="fp-avatar fp-avatar-large">АК</div>
        <div className="fp-person-copy">
          <div className="fp-person-labels">
            <Badge tone={tone}>{status}</Badge>
            <span>
              {profileId} · {version}
            </span>
          </div>
          <h2>{person}</h2>
          <p className="fp-person-program">
            «Время героев» · {details.flow.toLowerCase()} · {details.programYear}
          </p>
          {details.regionalProgram && (
            <p className="fp-person-regional">
              «{details.regionalProgram}»{details.regionalProgramYear && ` · ${details.regionalProgramYear}`}
            </p>
          )}
          <div className="fp-person-meta">
            <span>
              <Landmark size={15} />
              Регион: {details.region || 'не указан'}
            </span>
            <span>
              <CalendarDays size={15} />
              {details.birthYear || '—'} г. р.
            </span>
            <span>
              <ShieldCheck size={15} />
              Находится в запасе
            </span>
          </div>
          <div className="fp-person-contacts">
            <span>
              <Phone size={16} />
              {details.phone || 'Телефон не указан'}
            </span>
            <span>
              <Mail size={16} />
              {details.email || 'Почта не указана'}
            </span>
          </div>
        </div>
      </div>
      {(progress !== undefined || children) && (
        <div className="fp-person-actions">
          {progress !== undefined && <Ring value={progress} />}
          {children}
        </div>
      )}
    </Panel>
  )
}
