import { Plus, Trash2 } from 'lucide-react'
import type { CandidateDetails, Entity } from './types'
import type { ProfileModel } from './model'
import { activeRecords, fieldError, paymentFields, type FieldSpec } from './fields'
import { Field, FileRow, UploadBox } from './ui'

export function DataFields({ m, fields, values, onChange, onUpload, uploadLabel }: {
  m: ProfileModel
  fields: FieldSpec[]
  values: Record<string, string> | CandidateDetails
  onChange: (key: string, value: string) => void
  onUpload?: (key: string, name: string, file?: File) => void | Promise<unknown>
  uploadLabel?: string
}) {
  return <div className="fp-fields">
    {fields.map((spec) => {
      const value = (values as Record<string, string>)[spec.key] || ''
      const error = fieldError(spec, value, m.draft, values as Record<string, string>)
      if (spec.type === 'document') {
        const attachment = m.attachments.find((item) => item.id === value)
        return <div className="fp-field-wide fp-document-slot" key={spec.key}>
          <Field label={`Связать документ: ${spec.label}`} value={value}
            options={[{ value: '', label: 'Не прикреплён' }, ...m.attachments.filter((file) => file.kind === 'basis').map((file) => ({ value: file.id, label: file.name }))]}
            onChange={(next) => onChange(spec.key, next)} error={error} required={spec.required} />
          {attachment && <FileRow name={attachment.name} url={attachment.url} required={spec.required}
            note={`${attachment.origin === 'sample' ? 'Учебный документ' : 'Формат и размер проверены'} · содержание оценивает специалист`}
            onPreview={m.showDocument} onDownload={m.recordDownload} />}
          <UploadBox label={uploadLabel || `Загрузить: ${spec.label}`} optional={!spec.required} error={!!error}
            onUpload={onUpload ? (name, file) => onUpload(spec.key, name, file) : m.addAttachment} />
        </div>
      }
      const options = spec.type === 'recipient'
        ? [{ value: '', label: 'Выберите получателя' }, ...m.familyRecipients.map((person) => ({ value: person.id, label: `${person.fullName || 'Новый получатель'} · ${person.relation || 'связь не указана'}` }))]
        : spec.options
      return <Field key={spec.key} label={spec.label} value={value} options={options}
        type={spec.type === 'date' || spec.type === 'email' || spec.type === 'tel' ? spec.type : 'text'}
        required={spec.required} optional={!spec.required} wide={spec.wide} error={error} hint={spec.hint}
        onChange={(next) => onChange(spec.key, next)} />
    })}
  </div>
}

export function PaymentRecords({ m, category, recipientKind, rows: givenRows }: {
  m: ProfileModel; category: number; recipientKind?: string; rows?: Entity[]
}) {
  const rows = givenRows || activeRecords(m.draft, category).filter((row) => !recipientKind || row.recipientKind === recipientKind)
  return <div className="fp-record-list">
    {!rows.length && <p className="fp-empty-records">Записи не добавлены. Добавьте сведения или ответьте «Нет».</p>}
    {rows.map((record, index) => <fieldset className="fp-record-editor" key={record.id} data-record-id={record.id}>
      <legend>Запись {index + 1}</legend>
      <DataFields m={m} fields={paymentFields(category, record, m.draft)} values={record}
        onChange={(key, value) => m.updateRecord(category, record.id, key, value)}
        onUpload={(_key, name, file) => m.attachRecordDocument(category, record.id, name, file)}
        uploadLabel={category === 3 ? 'Документ для региональной поддержки' : undefined} />
      <button className="fp-text-button fp-delete-record" aria-label={`Удалить запись ${index + 1}`} onClick={() => m.removeRecord(category, record.id)}>
        <Trash2 size={15} /> Удалить запись
      </button>
    </fieldset>)}
    <button className="fp-text-button" onClick={() => m.addRecord(category, recipientKind)}><Plus size={15} /> Добавить запись</button>
  </div>
}
