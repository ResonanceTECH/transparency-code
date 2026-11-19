import { ArrowLeft, Printer, FileText, ClipboardCheck } from 'lucide-react'
import type { CandidateDetails, Entity, JsonValue, ProfileContent } from './types'
import type { ProfileModel } from './model'
import { categoryDefinitions } from './data'
import { activeRecords, activityFields, assessContent, fieldText, financialSummary, kinshipFields,
  paymentFields, personalFields, programFields, publishedContent, recipientFields, serviceFields, type FieldSpec } from './fields'
import { Notice, Field } from './ui'
import './print.css'

function PrintFields({ fields, values, content }: {
  fields: FieldSpec[]; values: Record<string, string> | CandidateDetails; content: ProfileContent
}) {
  return <dl className="fp-print-fields">{fields.map((field) => <div key={field.key}>
    <dt>{field.label}{field.required && ' *'}</dt><dd>{fieldText(field, values, content)}</dd>
  </div>)}</dl>
}

export function LegacyDetails({ content, print = false }: { content: ProfileContent; print?: boolean }) {
  const data = publishedContent(content).legacyData || {}
  const object = (value: JsonValue | undefined): Record<string, JsonValue> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const rows = (value: JsonValue | undefined) => Object.fromEntries(Object.entries(object(value)).map(([id, row]) => [id,
    Object.fromEntries(Object.entries(object(row)).filter(([key, item]) => key !== 'source_id' && (!['extra', 'fields'].includes(key) || Object.keys(object(item)).length > 0)))
  ]).filter(([, row]) => Object.keys(row).length > 0))
  const retained = {
    service_periods: rows(data.service_periods), activities: rows(data.activities),
    records: Object.fromEntries(Object.entries(object(data.records)).map(([category, value]) => [category, rows(value)]).filter(([, value]) => Object.keys(value).length > 0))
  }
  const additional = Array.isArray(data.additional_relatives) ? data.additional_relatives.map((relative) =>
    Object.fromEntries(Object.entries(object(relative)).filter(([key]) => key !== 'id'))) : []
  const sections = (['service_periods', 'records', 'activities'] as const).filter((key) => Object.keys(retained[key]).length > 0)
  if (!data.reserve_act_date && !additional.length && !sections.length) return null
  const Container = print ? 'section' : 'details'
  return <Container className="fp-legacy-details">
    {print ? <h2>Дополнительные сведения прежнего профиля</h2> : <summary>Дополнительные сохранённые сведения прежнего профиля</summary>}
    <p>Эти реквизиты не заменяют показанные поля. Они сохранены без потери дополнительных данных старого контракта; в представленной версии относятся только к включённым в неё строкам.</p>
    {!!data.reserve_act_date && <p><b>Отдельно сохранённая дата акта:</b> {String(data.reserve_act_date)}</p>}
    {!!additional.length && <><h3>Дополнительные родственники из прежней анкеты</h3><pre>{JSON.stringify(additional, null, 2)}</pre></>}
    {sections.map((key) => <div key={key}><h3>{key === 'records' ? 'Дополнительные реквизиты записей' : key === 'service_periods' ? 'Дополнительные реквизиты службы' : 'Дополнительные реквизиты деятельности'}</h3><pre>{JSON.stringify(retained[key], null, 2)}</pre></div>)}
  </Container>
}

// Только данные переданного агрегата. Компонент не читает состояние модели, DOM форм или API.
export function PrintableProfile({ content, version, status, draft, reply = '', createdAt = '', profileId = 'Учебный пример' }: {
  content: ProfileContent; version: number; status: string; draft: boolean; reply?: string; createdAt?: string; profileId?: string
}) {
  const report = assessContent(content)
  const summary = financialSummary(content)
  const scan = content.attachments.find((file) => file.id === content.consentDocumentId)
  return <article className="fp-print-document" aria-label="Единая анкета">
    <header className="fp-print-heading"><p className="fp-print-brand">РЕЗОНАНС · УЧЕБНЫЙ КОНТУР</p><h1>Цифровой финансовый профиль кандидата в резерв</h1>
      <p>{profileId} · {draft ? `Личный черновик версии ${version}` : `Представленная версия ${version}`} · {status}</p>
      {createdAt && <p>Версия зафиксирована: {createdAt}</p>}
      <p className="fp-print-disclaimer">Синтетические данные. Не является «Справкой БК», официальным заключением или решением о назначении. Печать сама по себе не передаёт сведения проверяющему.</p>
    </header>
    <section><h2>1. Личные сведения и контакты</h2>
      {content.photo && <div className="fp-print-photo">{content.photo.url && <img src={content.photo.url} alt="Фото для карточки" />}<span>Фото для карточки: {content.photo.name}{!content.photo.url && ' · оригинал недоступен'}</span></div>}
      <PrintFields fields={personalFields} values={content.candidate} content={content} />
    </section>
    <section><h2>2. Программа и включение в резерв</h2><PrintFields fields={programFields} values={content.candidate} content={content} /></section>
    <section><h2>3. Периоды службы и работы</h2>
      {content.servicePeriods.length ? content.servicePeriods.map((row, index) => <div className="fp-print-record" key={row.id}><h3>Период {index + 1}</h3><PrintFields fields={serviceFields.map((field) => field.key === 'category' ? { ...field, required: row.kind === 'Военная служба' } : field)} values={row} content={content} /></div>) : <p>НЕ ЗАПОЛНЕНО: периоды не добавлены.</p>}
    </section>
    <section><h2>4. Родство и получатели</h2><p><b>Является родственником участника СВО:</b> {content.relativeAnswer || 'НЕ УКАЗАНО'}</p>
      {content.relativeAnswer === 'Да' && <><PrintFields fields={kinshipFields} values={content.kinship} content={content} /><p><b>Получал выплаты в связи с этим родством:</b> {content.kinship.receivedPayments || 'НЕ УКАЗАНО'}</p></>}
      <h3>Получатели — члены семьи за резервиста</h3><p><b>Были такие выплаты:</b> {content.categoryAnswers[6] || 'НЕ УКАЗАНО'}</p>
      {content.categoryAnswers[6] === 'Да' && (content.familyRecipients.length ? content.familyRecipients.map((row, index) => <div className="fp-print-record" key={row.id}><h3>Получатель {index + 1}</h3><PrintFields fields={recipientFields} values={row} content={content} /></div>) : <p>НЕ ЗАПОЛНЕНО: получатели не добавлены.</p>)}
    </section>
    <section><h2>5. Выплаты и меры поддержки</h2>
      {categoryDefinitions.map((category, index) => <section className="fp-print-category" key={category.title}><h3>{index + 1}. {category.title}</h3>
        <p><b>Ответ:</b> {content.categoryAnswers[index] || 'НЕ УКАЗАНО'}</p>
        {index === 3 && <p>{Object.entries(content.supportLevels).map(([level, answer]) => `${level} уровень: ${answer || 'НЕ УКАЗАНО'}`).join(' · ')}</p>}
        {index === 4 && <p>Личные страховые выплаты: {content.personalInsuranceAnswer || 'НЕ УКАЗАНО'}. Выплаты за родственника: {content.relativeAnswer === 'Да' ? content.kinship.receivedPayments : 'не применимо'}.</p>}
        {index === 5 ? <p>Документ не требуется; ответ «Да / Нет» достаточен.</p> : content.categoryAnswers[index] === 'Нет' ? <p>Дополнительные сведения не требуются.</p> :
          activeRecords(content, index).length ? activeRecords(content, index).map((row, rowIndex) => <div className="fp-print-record" key={row.id}><h4>Запись {rowIndex + 1}</h4><PrintFields fields={paymentFields(index, row, content)} values={row} content={content} /></div>) : <p>НЕ ЗАПОЛНЕНО: записи не добавлены.</p>}
      </section>)}
      <div className="fp-print-summary"><p><b>Сумма денежных записей резервиста:</b> {summary.personal} ₽ ({summary.personalRecords} записей).</p><p><b>Отдельно: выплаты членам семьи:</b> {summary.family} ₽.</p>
        <p>Суммы приведены из анкеты без подтверждения подлинности. Возможные дубли автоматически не вычитаются. Натуральные, неденежные и жилищные меры не прибавляются к этим суммам.</p></div>
    </section>
    <section><h2>6. Экспертная и преподавательская деятельность</h2><p><b>Участвует:</b> {content.activityAnswer || 'НЕ УКАЗАНО'}</p>
      {content.activityAnswer === 'Да' && (content.activities.length ? content.activities.map((row, index) => <div className="fp-print-record" key={row.id}><h3>Деятельность {index + 1}</h3><PrintFields fields={activityFields} values={row} content={content} /></div>) : <p>НЕ ЗАПОЛНЕНО: деятельность не добавлена.</p>)}
    </section>
    <section><h2>7. Приложенные документы и согласие</h2><p><b>Подписанный скан согласия на обработку ПДн:</b> {scan ? `${scan.name}${scan.url ? '' : ' · ОРИГИНАЛ НЕДОСТУПЕН'}` : 'НЕ ПРИКРЕПЛЁН'}</p><p>Наличие подписи, читаемость и содержание документов требуют ручной проверки. Здесь приведён реестр; оригиналы файлов остаются отдельными приложениями.</p>
      <table className="fp-print-table"><thead><tr><th>№</th><th>Файл</th><th>Раздел / назначение</th></tr></thead><tbody>{content.attachments.map((file, index) => <tr key={file.id}><td>{index + 1}</td><td>{file.name}{!file.url && ' · ОРИГИНАЛ НЕДОСТУПЕН'}</td><td>{file.section}{file.origin === 'sample' && ' · учебный пример'}</td></tr>)}</tbody></table>
    </section>
    {reply && <section><h2>8. Пояснение к уточнениям</h2><p className="fp-print-reply">{reply}</p></section>}
    <LegacyDetails content={content} print />
    <section className="fp-print-completeness"><h2>Комплектность введённых сведений</h2><p>Заполнено {report.completed} из 7 обязательных блоков.</p>
      {!!report.missing && <><p><b>Анкета неполная. Перед отправкой заполните:</b></p><ul>{report.rows.filter((row) => row.issues.length).map((row) => <li key={row.title}><b>{row.title}:</b> {Array.from(new Set(row.issues)).join('; ')}</li>)}</ul></>}
      <p>Эта отметка отражает заполнение полей и наличие файлов, но не качество сканов и не итог кадровой проверки.</p>
    </section>
    <footer className="fp-print-signature"><p>ФИО кандидата: {content.candidate.fullName || '________________________________'}</p><p>Дата: ____________________ Подпись: ____________________</p><p>Распечатка не содержит электронной подписи и не заменяет подписанное согласие оператора.</p></footer>
  </article>
}

export function PrintScreen(m: ProfileModel) {
  const content = m.printContent
  if (!content) return null
  return <div className="fp-print-page"><div className="fp-print-toolbar">
    <button className="fp-button fp-button-outline" onClick={() => m.navigate(m.role === 'reservist' ? 'home' : 'case')}><ArrowLeft size={15} />К профилю</button>
    {m.role === 'reservist' && <Field label="Данные для печати" value={m.printSource} options={[
      { value: 'draft', label: 'Текущий личный черновик' }, ...(m.presented ? [{ value: 'submitted', label: `Представленная версия ${m.presented.version}` }] : [])
    ]} onChange={(value) => m.setPrintSource(value as 'draft' | 'submitted')} />}
    {!m.printDraft && m.versions.length > 1 && <Field label="Представленная версия для печати" value={String(m.printedVersion?.version || '')}
      options={m.versions.map((version) => ({ value: String(version.version), label: `Версия ${version.version} · ${version.createdAt}` }))}
      onChange={(value) => m.setPrintVersion(Number(value))} />}
    <button className="fp-button" onClick={m.printProfile}><Printer size={16} />Печать / сохранить PDF</button>
    <Notice tone="neutral">В окне печати браузера выберите принтер или «Сохранить как PDF». Выгружается вся анкета, а не текущая вкладка.</Notice>
  </div><PrintableProfile profileId={m.profileId} content={content} version={m.printDraft ? m.workingVersion : m.printedVersion?.version || 1}
    status={m.printDraft ? 'Не передан проверяющему' : `${m.printedVersion?.version !== m.presented?.version ? 'Историческая версия · текущий статус материала: ' : ''}${m.profileStatus}`} draft={m.printDraft}
    reply={m.printDraft ? m.privateReply : m.printedVersion?.reply || ''} createdAt={m.printDraft ? '' : m.printedVersion?.createdAt} />
  </div>
}

const templates = [
  { id: 'profile', title: 'Пустая анкета кандидата', description: 'Личные сведения, служба, родство, выплаты, деятельность и приложения.', icon: FileText },
  { id: 'payment', title: 'Лист описания выплаты', description: 'Универсальная заготовка: получатель → вид → основание → период → документ.', icon: Printer },
  { id: 'scan', title: 'Памятка по качеству скана', description: 'Что проверить до загрузки и что затем оценивает кадровый специалист.', icon: ClipboardCheck }
]
function BlankFields({ fields }: { fields: FieldSpec[] }) {
  return <dl className="fp-print-fields">{fields.map((field) => <div key={field.key}><dt>{field.label}{field.required && ' *'}{field.options && ` (${field.options.join(' / ')})`}</dt><dd>________________________________________________</dd></div>)}</dl>
}
const blankContent: ProfileContent = {
  candidate: {} as CandidateDetails, servicePeriods: [], relativeAnswer: '', kinship: { fullName: '', degree: '', status: '', receivedPayments: '' },
  familyRecipients: [], categoryAnswers: {}, supportLevels: {}, personalInsuranceAnswer: '', records: {}, activityAnswer: '', activities: [], attachments: [], consentDocumentId: '', photo: null
}

export function TemplatesScreen(m: ProfileModel) {
  const template = templates.find((item) => item.id === m.templateId) || templates[0]
  return <div className="fp-template-page"><div className="fp-template-controls"><Notice tone="neutral"><strong>Учебная библиотека, не каталог официальных выплат.</strong> Заготовки помогают собрать сведения. НПА, формы региональных выплат и действующее согласие предоставляет уполномоченный орган.</Notice>
    <div className="fp-template-grid">{templates.map((item) => <button className={`fp-template-card ${item.id === template.id ? 'active' : ''}`} key={item.id} aria-pressed={item.id === template.id} onClick={() => m.setTemplateId(item.id)}>
      <item.icon size={25} /><strong>{item.title}</strong><span>{item.description}</span>
    </button>)}</div><div className="fp-print-toolbar"><button className="fp-button" onClick={m.printTemplate}><Printer size={16} />Печать шаблона / сохранить PDF</button><p>Печатается только выбранная заготовка, без данных кандидата.</p></div>
  </div><article className="fp-print-document" aria-label="Учебный шаблон"><header className="fp-print-heading"><p className="fp-print-brand">РЕЗОНАНС · УЧЕБНЫЙ ШАБЛОН</p><h1>{template.title}</h1><p className="fp-print-disclaimer">Не официальная форма, не правовой акт и не основание для назначения выплаты. Заполняется для подготовки сведений. Поля со звёздочкой нужны в анкете платформы.</p></header>
    {template.id === 'profile' ? <>
      <section><h2>1. Личные сведения и программа</h2><BlankFields fields={[...personalFields, ...programFields]} /></section>
      <section><h2>2. Служба и работа</h2><BlankFields fields={serviceFields} /><p>Для нескольких периодов добавьте отдельные листы.</p></section>
      <section><h2>3. Родство и получатели</h2><p>Являетесь родственником участника СВО? ☐ Да ☐ Нет. Получали выплаты в связи с родством? ☐ Да ☐ Нет.</p><BlankFields fields={kinshipFields} /><h3>Получатель — член семьи за резервиста</h3><BlankFields fields={recipientFields} /></section>
      <section><h2>4. Выплаты и меры</h2>{categoryDefinitions.map((category, index) => <div className="fp-print-category" key={category.title}><h3>{index + 1}. {category.title}</h3><p>Ответ: ☐ Да ☐ Нет {index === 8 && '☐ Планируется при наличии документа'}</p>
        {index === 5 ? <p>Документ не требуется.</p> : <BlankFields fields={paymentFields(index, { id: '', form: 'Денежная' }, { ...blankContent, categoryAnswers: { 8: 'Да' } })} />}
        {index === 8 && <p>Для планируемой меры: предполагаемый год ________________; документ-основание ____________________________.</p>}
        {index === 7 && <p>Для натуральной помощи: описание предоставленной меры ____________________________________.</p>}
      </div>)}</section>
      <section><h2>5. Деятельность</h2><p>Участвуете? ☐ Да ☐ Нет</p><BlankFields fields={activityFields} /></section>
      <section><h2>6. Приложения</h2><p>Перечень файлов: __________________________________________________</p><p>Подписанный скан согласия по форме действующего оператора: ______________________________</p></section>
    </> : template.id === 'payment' ? <><section><h2>Описание записи</h2><BlankFields fields={[
      { key: 'category', label: 'Категория выплаты или меры', required: true }, { key: 'recipient', label: 'Получатель (ФИО и вид получателя)', required: true },
      { key: 'relation', label: 'Связь с резервистом / родственником, если применимо' }, { key: 'title', label: 'Наименование выплаты или меры', required: true },
      { key: 'amount', label: 'Сумма либо описание натуральной формы' }, { key: 'payer', label: 'Плательщик / орган назначения' },
      { key: 'basis', label: 'Основание, реквизиты и применимая редакция НПА', required: true }, { key: 'event', label: 'Событие и дата, если применимо' },
      { key: 'period', label: 'Период, к которому относится основание', required: true }, { key: 'date', label: 'Дата фактического перечисления' },
      { key: 'document', label: 'Название прилагаемого документа-основания' }, { key: 'comment', label: 'Пояснение кандидата' }
    ]} /></section><p>Это описание уже назначенной выплаты, а не документ для её назначения. Не заменяет региональную форму или НПА. Документ для пенсий не запрашивается; для единовременных выплат прикладывается при наличии.</p></>
      : <section><h2>Перед загрузкой</h2><ul className="fp-print-checklist">{[
        'Все страницы документа приложены, порядок страниц сохранён.', 'Текст, даты, номера, сумма и ФИО читаются при обычном увеличении.',
        'Края страниц не обрезаны, важные реквизиты не закрыты пальцами или бликами.', 'Файл открывается; PDF / DOCX для оснований, PDF / PNG / JPG для скана согласия, до 5 МБ.',
        'Документ относится к выбранной записи, получателю и периоду основания.', 'Для согласия использована форма действующего оператора и присутствует подпись.',
        'Банковские выписки, медицинские сведения и полный профиль родственника не добавлены.'
      ].map((item) => <li key={item}>☐ {item}</li>)}</ul><h2>Что делает платформа</h2><p>Проверяет наличие файла, размер, разрешённый формат и сигнатуру контейнера. Эта проверка не гарантирует полноту и читаемость.</p><h2>Что оценивает кадровый специалист</h2><p>Открывает документ, проверяет читаемость, страницы, подпись и соответствие основанию. Фиксирует оценку с комментарием; при необходимости связывается с кандидатом или запрашивает конкретику.</p><p>Нет автоматического признания нарушения, проверки подлинности подписи или решения о назначении.</p></section>}
  </article></div>
}
