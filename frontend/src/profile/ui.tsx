import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Download,
  Info,
  Landmark,
  Mail,
  Paperclip,
  Phone,
  ShieldCheck,
  Upload,
  AlertCircle
} from 'lucide-react'
import type { Tone, CandidateDetails, Attachment } from './types'
import { checkFile } from './documents'

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
  options?: (string | { value: string; label: string })[]
  required?: boolean
  optional?: boolean
  error?: string
  hint?: string
  wide?: boolean
  onChange?: (value: string) => void
  type?: string
}) {
  const id = useId()
  return (
    <label className={`fp-field ${wide ? 'fp-field-wide' : ''} ${error ? 'fp-field-error' : ''}`}>
      <span className="fp-field-label">
        {label}
        {required && <em aria-hidden="true"> *</em>}
        {optional && <small>Необязательно</small>}
      </span>
      {options ? (
        <select
          id={id}
          aria-label={label}
          value={value}
          disabled={!onChange}
          aria-required={required}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${id}-help` : undefined}
          onChange={(e) => onChange?.(e.target.value)}
        >
          {!value && <option value="" disabled>Выберите значение</option>}
          {value && !options.some((option) => (typeof option === 'string' ? option : option.value) === value) && <option value={value}>Сохранённое значение: {value}</option>}
          {options.map((option) => (
            <option key={typeof option === 'string' ? option : option.value} value={typeof option === 'string' ? option : option.value}>
              {typeof option === 'string' ? option : option.label}
            </option>
          ))}
        </select>
      ) : onChange ? (
        <input
          id={id}
          aria-label={label}
          type={type}
          maxLength={4000}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-required={required}
          aria-describedby={error || hint ? `${id}-help` : undefined}
        />
      ) : (
        <input id={id} aria-label={label} type={type} value={value} readOnly aria-required={required} />
      )}
      {error && (
        <span id={`${id}-help`} className="fp-field-feedback">
          <AlertCircle size={13} />
          {error}
        </span>
      )}
      {hint && !error && <small id={`${id}-help`} className="fp-field-hint">{hint}</small>}
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
          disabled={!onChange}
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
  onPreview,
  url,
  onDownload
}: {
  name: string
  note?: string
  required?: boolean
  onPreview?: (name: string, url?: string) => void
  url?: string
  onDownload?: (name: string) => void
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
      <Badge tone={url ? 'teal' : 'amber'}>
        {url && <Check size={13} />}
        {url ? 'Добавлен' : 'Оригинал недоступен'}
      </Badge>
      {onPreview && (
        <button className="fp-icon-button" aria-label={`Просмотреть ${name}`} onClick={() => onPreview(name, url)}>
          <ChevronRight size={17} />
        </button>
      )}
      {url && <a className="fp-icon-button" aria-label={`Скачать ${name}`} href={downloadUrl(url)} download={name} onClick={() => onDownload?.(name)}>
        <Download size={16} />
      </a>}
    </div>
  )
}
export function UploadBox({
  label,
  error,
  optional = false,
  onUpload,
  mode = 'basis'
}: {
  label: string
  error?: boolean
  optional?: boolean
  onUpload?: (name: string, file?: File) => void | Promise<unknown>
  mode?: 'basis' | 'scan' | 'photo'
}) {
  const [fileError, setFileError] = useState('')
  const [busy, setBusy] = useState(false)
  const id = useId()
  const formats = mode === 'basis' ? 'PDF, DOCX' : mode === 'photo' ? 'PNG, JPG' : 'PDF, PNG, JPG'
  return (
    <label className={`fp-upload ${error || fileError ? 'fp-upload-error' : ''}`}>
      <span className="fp-upload-icon">
        <Upload size={22} />
      </span>
      <div>
        <strong>{label}</strong>
        <small>
          {mode === 'scan' ? 'Подписанный скан согласия' : mode === 'photo' ? 'Необязательно · без распознавания лиц'
            : optional ? 'При наличии · не блокирует отправку' : 'НПА, решение, договор или справка органа'} · {formats} · до 5 МБ
        </small>
        {(fileError || error) && <span id={`${id}-error`} className="fp-field-feedback" role={fileError ? 'alert' : undefined}>
          {fileError || 'Прикрепите обязательный документ'}
        </span>}
      </div>
      <span className="fp-button fp-button-outline">
        <Paperclip size={15} />
        {busy ? 'Проверяем и загружаем…' : 'Выбрать файл'}
      </span>
      <input
        type="file"
        aria-label={label}
        aria-describedby={fileError || error ? `${id}-error` : undefined}
        aria-invalid={!!fileError}
        disabled={busy || !onUpload}
        accept={mode === 'basis' ? '.pdf,.docx' : mode === 'photo' ? '.png,.jpg,.jpeg' : '.pdf,.png,.jpg,.jpeg'}
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setFileError('')
          setBusy(true)
          try {
            const problem = await checkFile(file, mode)
            if (problem) setFileError(problem)
            else await onUpload?.(file.name, file)
          } catch (failure) { setFileError(failure instanceof Error ? failure.message : 'Загрузка не подтверждена сервером') }
          finally { setBusy(false) }
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
  progress,
  photo,
  profileId = ''
}: {
  status: string
  tone: Tone
  version: string
  details: CandidateDetails
  children?: ReactNode
  progress?: number
  photo?: Attachment | null
  profileId?: string
}) {
  return (
    <Panel className="fp-person-header">
      <div className="fp-person-identity">
        <div className="fp-avatar fp-avatar-large">
          {photo?.url ? <img src={photo.url} alt={`Фото ${details.fullName}`} /> : details.fullName.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}
        </div>
        <div className="fp-person-copy">
          <div className="fp-person-labels">
            <Badge tone={tone}>{status}</Badge>
            <span>
              {profileId && `${profileId} · `}{version}
            </span>
          </div>
          <h2>{details.fullName || 'ФИО не указано'}</h2>
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
              {details.workStatus || 'Статус работы не указан'}
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

export function downloadUrl(url: string): string {
  return url.startsWith('/api/') ? `${url}${url.includes('?') ? '&' : '?'}download=true` : url
}
