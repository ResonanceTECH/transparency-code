import {
  ArrowLeft, ArrowRight, BadgeCheck, BookOpen, BriefcaseBusiness, CalendarDays, Check,
  CheckCircle2, ChevronRight, ClipboardCheck, Clock3, Download, FileCheck2, FileText, GraduationCap,
  History, Home, Inbox, Landmark, Link2, LockKeyhole, MessageSquareText, Plus, RotateCw, Search,
  Send, ShieldCheck, Trash2, Upload, UserRound, UsersRound, WalletCards, AlertCircle
} from 'lucide-react'
import type { ProfileModel } from './model'
import type { CandidateDetails, DocumentAssessment, ProfileContent, Screen } from './types'
import { profileStages, categoryDefinitions } from './data'
import { timeText } from './api'
import { LegacyDetails } from './print'
import { activeRecords, activityFields, assessContent, dateText, kinshipFields, personalFields,
  programFields, recipientFields, serviceFields } from './fields'
import { CONSENT_SAMPLE } from './documents'
import { DataFields, PaymentRecords } from './editors'
import { Badge, Panel, PanelTitle, Notice, Field, Choice, FileRow, UploadBox, PersonHeader } from './ui'

function BackToPayments({ m }: { m: ProfileModel }) {
  return <button className="fp-back" onClick={() => m.navigate('payments')}><ArrowLeft size={15} />К категориям выплат</button>
}
function SavePayments({ m }: { m: ProfileModel }) {
  return <button className="fp-button" disabled={!m.editable || m.busy} onClick={() => m.saveAndNavigate('payments')}><Check size={16} />Сохранить и вернуться</button>
}

export function HomeScreen(m: ProfileModel) {
  if (m.reviewerClosed) return <>
    <PersonHeader profileId={m.profileId} status={m.profileStatus} tone={m.phase === 'completed' ? 'teal' : 'neutral'}
      version={`представленная версия ${m.presented?.version}`} details={m.presented?.candidate || m.candidate} photo={m.presented?.photo}>
      <div className="fp-person-next"><span className="fp-eyebrow">СПЕЦИАЛИСТ</span><strong>{m.decisionAuthor}</strong>
        <Badge tone={m.decisionDocument ? 'teal' : 'neutral'}><FileCheck2 size={13} />{m.decisionDocument ? 'Основание внесено' : 'Исторический результат'}</Badge></div>
    </PersonHeader>
    <Notice tone="teal" icon={<BadgeCheck size={21} />}><strong>Результат рассмотрения доступен вам.</strong> Он относится к сведениям, а не к назначению на должность.</Notice>
    <div className="fp-columns fp-form-columns">
      <Panel><PanelTitle title="Основание результата" subtitle="Зафиксировано кадровым специалистом" />
        <div className="fp-result-basis"><FileCheck2 size={26} /><div><strong>{m.decisionBasis}</strong><small>Версия {m.presented?.version}</small></div></div>
        <p className="fp-reply-text">{m.decisionComment}</p>
        {m.decisionDocument && <FileRow name={m.decisionFile} url={m.decisionDocument.url} onPreview={m.showDocument} onDownload={m.recordDownload} />}
      </Panel>
      <Panel className="fp-privacy-card"><ShieldCheck size={28} /><h2>Решение о назначении — вне платформы</h2>
        <p>Завершение рассмотрения не является автоматическим допуском или отказом в назначении.</p></Panel>
    </div>
  </>
  return <>
    <PersonHeader profileId={m.profileId} status={m.profileStatus} tone={m.sent ? m.phase === 'clarification' ? 'amber' : 'teal' : 'blue'}
      version={m.hasDraftChanges ? `личный черновик версии ${m.workingVersion}` : m.sent ? `представленная версия ${m.presented?.version}` : 'версия 1'} details={m.candidate}
      photo={m.draft.photo} progress={!m.sent ? m.progress : undefined}>
      <button className="fp-button" onClick={() => m.navigate(m.sent ? 'messages' : 'selfcheck')}>
        {m.sent ? 'Уточнения и статус' : 'Самопроверка'}<ArrowRight size={16} />
      </button>
    </PersonHeader>
    {m.canLoadDemo && <Notice tone="neutral"><strong>Серверный профиль пока пуст.</strong> Можно заполнить его вручную или явно добавить вымышленный сценарий Ковалёва. Уже существующие сведения эта кнопка не заменяет.
      <br /><button className="fp-text-button" onClick={m.loadDemoDraft} disabled={m.busy}>Заполнить пустой черновик демо-данными<ArrowRight size={15} /></button></Notice>}
    <LegacyDetails content={m.visibleContent} />
    {m.hasDraftChanges && <Notice tone="neutral">Личные изменения пока не представлены. Специалист видит только версию {m.presented?.version}; текущий черновик можно просмотреть целиком через «Печать».</Notice>}
    <div className="fp-columns fp-home-columns">
      <Panel><PanelTitle title="Разделы профиля" action={<Badge tone="neutral">{m.documentCount} документов</Badge>} />
        <div className="fp-section-list">
          {[
            ['Личные сведения и программа', 'Контакты, поток, диплом и акт о включении в резерв', 'profile', 0, <UserRound size={20} />],
            ['Служба, родство и получатели', 'Периоды службы и минимальные сведения о родственниках', 'kinship', 1, <UsersRound size={20} />],
            ['Выплаты и меры поддержки', `${m.completeness.answers} из 10 ответов · ${m.recordCount} записей и мер`, 'payments', 2, <WalletCards size={20} />],
            ['Экспертная и преподавательская работа', 'Организация, договор и период деятельности', 'activities', 5, <GraduationCap size={20} />],
            ['Документы и согласие', 'Основания и обязательный подписанный скан согласия', 'documents', 6, <FileText size={20} />]
          ].map(([title, note, screen, row, icon]) => {
            const done = !m.completeness.rows[Number(row)].issues.length
            return <button className={`fp-section-row ${done ? 'done' : 'pending'}`} key={String(title)} onClick={() => m.navigate(screen as Screen)}>
              <span className="fp-section-icon">{done ? <Check size={20} /> : icon}</span><div><strong>{title}</strong><small>{note}</small></div>
              <Badge tone={done ? 'teal' : 'amber'}>{done ? 'Заполнено' : 'Нужно дополнить'}</Badge>
            </button>
          })}
        </div>
      </Panel>
      <div className="fp-stack">
        <Panel className="fp-recent-card"><PanelTitle title="Последние действия" action={<History size={19} />} />
          <div className="fp-recent-actions">{m.audit.filter((event) => event.role === 'reservist').slice(-3).reverse().map((event, index) =>
            <div key={index}><span /><div><small>{event.time}</small><strong>{event.action}</strong></div></div>)}</div>
        </Panel>
        <Notice tone="neutral" icon={<LockKeyhole size={20} />}><strong>{m.sent ? 'Зафиксирована только отправленная версия.' : 'Личный черновик доступен только кандидату в резерв.'}</strong><br />
          Изменения, подсказки и история черновика не передаются проверяющему.
          <br /><button className="fp-text-button" onClick={() => m.navigate('instructions')}>Правила передачи сведений<ArrowRight size={14} /></button>
        </Notice>
        <Panel><PanelTitle title="Проверьте анкету целиком" /><p>Печать доступна и до отправки. В документе будут видны незаполненные поля.</p>
          <button className="fp-text-button" onClick={() => m.navigate('print')}>Сформировать единую анкету<ArrowRight size={15} /></button></Panel>
      </div>
    </div>
  </>
}

export function ProfileScreen(m: ProfileModel) {
  return <div className="fp-columns fp-form-columns">
    <div className="fp-stack">
      <Panel><PanelTitle eyebrow="ЭТАП 10%" title="Личные сведения и контакты" action={<Badge tone="teal">Указаны пользователем</Badge>} />
        <DataFields m={m} fields={personalFields} values={m.candidate} onChange={(key, value) => m.updateCandidate(key as keyof CandidateDetails, value)} />
      </Panel>
      <Panel><PanelTitle eyebrow="ЭТАП 30%" title="Программа и включение в резерв" />
        <DataFields m={m} fields={programFields} values={m.candidate} onChange={(key, value) => m.updateCandidate(key as keyof CandidateDetails, value)}
          onUpload={(key, name, file) => m.attachProfileDocument(key as 'diplomaDocumentId' | 'reserveActDocumentId', name, file)} />
      </Panel>
      <Panel><PanelTitle eyebrow="ЭТАП 50%" title="Периоды воинской и государственной службы" action={
        <button className="fp-button fp-button-outline" onClick={m.addServicePeriod}><Plus size={15} />Добавить период</button>} />
        <div className="fp-record-list">
          {m.servicePeriods.map((period, index) => <fieldset className="fp-record-editor" key={period.id} data-service-id={period.id}>
            <legend>Период {index + 1}</legend>
            <DataFields m={m} fields={serviceFields.map((field) => field.key === 'category' ? { ...field, required: period.kind === 'Военная служба' } : field)}
              values={period} onChange={(key, value) => m.updateServicePeriod(period.id, key, value)} />
            <button className="fp-text-button fp-delete-record" aria-label={`Удалить период ${index + 1}`} onClick={() => m.removeServicePeriod(period.id)}><Trash2 size={15} />Удалить период</button>
          </fieldset>)}
          {!m.servicePeriods.length && <Notice tone="red">Добавьте период службы или работы. Отправка без этих сведений недоступна.</Notice>}
        </div>
        <small className="fp-footnote">Военная, государственная служба или иное. Категории офицерского состава включают волонтёров.</small>
      </Panel>
    </div>
    <div className="fp-stack">
      <Panel className="fp-mini-person"><div className="fp-avatar fp-avatar-photo">
        {m.draft.photo?.url ? <img src={m.draft.photo.url} alt="Фото для карточки" /> : <UserRound size={33} />}</div>
        <h2>Фото для карточки</h2><p>Необязательное поле</p>
        <UploadBox label="Фото для карточки" mode="photo" optional onUpload={(_name, file) => file && m.attachPhoto(file)} />
        {m.draft.photo && <button className="fp-text-button fp-delete-record" onClick={() => m.removeAttachment(m.draft.photo!.id)}><Trash2 size={15} />Удалить фото из черновика</button>}
        <small>Только для визуального удобства. Распознавание лиц не используется.</small>
      </Panel>
      <Notice tone="neutral" icon={<LockKeyhole size={19} />}>Изменения останутся в личном черновике до отправки новой версии.</Notice>
      <button className="fp-button fp-full" onClick={() => m.navigate('kinship')}>Родство и получатели<ArrowRight size={16} /></button>
    </div>
  </div>
}

export function KinshipScreen(m: ProfileModel) {
  return <div className="fp-columns fp-form-columns">
    <div className="fp-stack">
      <Panel><PanelTitle eyebrow="ЭТАП 50%" title="Родство с участником СВО" action={<Badge tone="teal">Ответ дан</Badge>} />
        <div className="fp-question"><strong>Являетесь ли вы родственником участника СВО?</strong><Choice value={m.relativeAnswer} onChange={m.setRelativeAnswer} /></div>
        {m.relativeAnswer === 'Да' ? <>
          <DataFields m={m} fields={kinshipFields} values={m.kinship} onChange={(key, value) => m.updateKinship(key as keyof ProfileContent['kinship'], value)} />
          <div className="fp-question fp-question-bordered"><div><strong>Получали ли вы выплаты в связи с этим родством?</strong><small>Получатель — вы; основание связано с родственником</small></div>
            <Choice value={m.kinship.receivedPayments} onChange={(value) => m.updateKinship('receivedPayments', value)} /></div>
          {m.kinship.receivedPayments === 'Да' && <button className="fp-linked-record" onClick={() => m.navigate('insurance')}><Link2 size={19} /><div><strong>Сведения о выплатах за родственника</strong><small>Отдельная связь с основанием</small></div><ChevronRight size={19} /></button>}
        </> : <Notice tone="teal">Дополнительные поля родства закрыты. Данные родственника не запрашиваются.</Notice>}
      </Panel>
      <Panel><PanelTitle title="Выплата члену семьи за кандидата в резерв" subtitle="Отдельный блок: получатель не сам кандидат в резерв" action={<Badge tone="blue">{m.familyRecipients.length} получателей</Badge>} />
        <div className="fp-question"><strong>Получал ли член семьи выплату за кандидата в резерв?</strong><Choice value={m.categoryAnswers[6]} onChange={(value) => m.setCategoryAnswer(6, value)} /></div>
        {m.categoryAnswers[6] === 'Да' ? <>
          <div className="fp-record-list">{m.familyRecipients.map((recipient, index) => <fieldset className="fp-record-editor" key={recipient.id}>
            <legend>Получатель {index + 1}</legend><DataFields m={m} fields={recipientFields} values={recipient} onChange={(key, value) => m.updateRecipient(recipient.id, key, value)} />
            <button className="fp-text-button fp-delete-record" aria-label={`Удалить получателя ${index + 1}`} onClick={() => m.removeRecipient(recipient.id)}><Trash2 size={15} />Удалить получателя</button>
          </fieldset>)}</div>
          <button className="fp-text-button" onClick={m.addRecipient}><Plus size={15} />Добавить сведения о другом получателе</button>
          <button className="fp-text-button" onClick={() => { m.setActiveCategory(6); m.navigate('category') }}>К записям выплат членам семьи<ArrowRight size={15} /></button>
        </> : <Notice tone="teal">Поля получателей закрыты. Выплаты членам семьи не указаны.</Notice>}
      </Panel>
    </div>
    <div className="fp-stack">
      <Panel className="fp-privacy-card"><UsersRound size={28} /><h2>Минимум данных о родственнике</h2><p>Только ФИО, степень родства и предусмотренный анкетой статус.</p>
        <ul><li>Без подробностей службы</li><li>Без медицинских сведений</li><li>Без полного финансового профиля</li></ul></Panel>
      <Panel><PanelTitle title="Не путайте получателей" />
        <p>Выплата кандидату в резерв за родственника и выплата члену семьи за кандидата в резерв — разные записи.</p>
        <Notice>Год рождения нужен для получателя — члена семьи, но не для минимальной карточки участника СВО.</Notice>
      </Panel>
    </div>
  </div>
}

export function PaymentsScreen(m: ProfileModel) {
  return <>
    <div className="fp-payments-summary"><div><span className="fp-summary-symbol"><WalletCards size={26} /></span><div>
      <span className="fp-eyebrow">ЭТАП 70% · ОТВЕТЫ ПО КАЖДОМУ БЛОКУ</span><h2>{m.completeness.answers} из 10 ответов даны</h2><p>Записи и обязательные вложения учитываются на этапе 90%</p>
    </div></div><div className="fp-summary-count"><strong>{categoryDefinitions.filter((_, index) => !m.completeness.categoryIssues(index).length).length}<span> / 10</span></strong><small>блоков готовы</small></div></div>
    <Panel className="fp-category-panel"><div className="fp-category-head"><span>Категория и требования к вводу</span><span>Ваш ответ</span><span>Сведения</span><span>Готовность</span></div>
      {categoryDefinitions.map((category, index) => {
        const issues = m.completeness.categoryIssues(index)
        const answer = m.categoryAnswers[index]
        const rows = activeRecords(m.draft, index)
        return <button key={category.title} className={`fp-category-row ${issues.length ? 'fp-category-missing' : ''}`} onClick={() => {
          m.setActiveCategory(index); m.navigate(category.target || 'category')
        }}><div className="fp-category-main"><span className="fp-category-index">{String(index + 1).padStart(2, '0')}</span><span className="fp-category-icon">{category.icon}</span><div><strong>{category.title}</strong><small>{category.note}</small></div></div>
          <Badge tone={answer === 'Нет' ? 'neutral' : answer === 'Планируется' ? 'blue' : 'teal'}>{answer || 'Ответ не дан'}</Badge>
          <span className="fp-category-records">{index === 5 ? 'Без вложений' : answer === 'Нет' ? 'Нет выплат / мер' : `${rows.length} записей`}</span>
          <span className={`fp-category-status ${issues.length ? 'missing' : ''}`}>{issues.length ? <><AlertCircle size={16} />Нужно дополнить</> : <><CheckCircle2 size={16} />Заполнено</>}<ChevronRight size={15} /></span>
        </button>
      })}
    </Panel>
    <div className="fp-payments-bottom"><Notice><strong>Не все «Да» требуют справку.</strong> Для пенсий и социальных выплат документ не запрашивается; для единовременной выплаты — при наличии.</Notice>
      <button className="fp-button" onClick={() => m.navigate('selfcheck')}>К самопроверке<ArrowRight size={16} /></button></div>
  </>
}

export function CategoryScreen(m: ProfileModel) {
  const category = categoryDefinitions[m.activeCategory]
  const answer = m.categoryAnswers[m.activeCategory]
  return <><BackToPayments m={m} /><div className="fp-columns fp-form-columns"><div className="fp-stack">
    <Panel><PanelTitle title={category.title} action={<Badge tone="blue">Блок {m.activeCategory + 1} / 10</Badge>} />
      <div className="fp-question"><strong>{m.activeCategory === 9 ? 'Предоставлялась ли неденежная мера поддержки?' : 'Осуществлялась ли выплата или предоставлялась мера?'}</strong>
        <Choice value={answer} onChange={(value) => m.setCategoryAnswer(m.activeCategory, value)} /></div>
      {m.activeCategory === 5 ? <Notice tone="teal"><strong>Документированные сведения не требуются.</strong><br />Нужен только ответ «Да / Нет». Справки из банков и социальных фондов не запрашиваются.</Notice>
        : answer === 'Нет' ? <Notice tone="teal">Ответ дан. Дополнительные поля этой категории закрыты.</Notice>
          : <><PaymentRecords m={m} category={m.activeCategory} />
            {m.activeCategory === 1 && <UploadBox label="Дополнительное основание надбавки" optional onUpload={m.addAttachment} />}
            {[7, 9].includes(m.activeCategory) && <Notice tone="blue">Натуральные и неденежные меры учитываются отдельно, не прибавляются к денежным поступлениям.</Notice>}
          </>}
    </Panel><SavePayments m={m} />
  </div><div className="fp-stack"><Panel className="fp-explain-card"><span className="fp-explain-symbol">{category.icon}</span><h2>{m.activeCategory === 6 ? 'Это не личная выплата кандидата в резерв' : 'Основание важнее банковской справки'}</h2><p>{category.note}</p>
    {m.activeCategory === 6 && <button className="fp-text-button" onClick={() => m.navigate('kinship')}>Добавить или изменить получателей<ArrowRight size={14} /></button>}</Panel>
    <Notice tone="neutral">Нет банковских выписок и автоматического юридического решения. Значимость документов оценивает кадровый специалист.</Notice></div></div></>
}

export function PaymentScreen(m: ProfileModel) {
  return <><BackToPayments m={m} /><div className="fp-columns fp-form-columns"><div className="fp-stack"><Panel>
    <PanelTitle title="Событие, получатель и основание" action={<Badge tone="blue">Единовременные выплаты</Badge>} />
    <div className="fp-question"><strong>Получали ли вы единовременную выплату?</strong><Choice value={m.categoryAnswers[2]} onChange={(value) => m.setCategoryAnswer(2, value)} /></div>
    {m.categoryAnswers[2] === 'Да' ? <PaymentRecords m={m} category={2} /> : <Notice tone="teal">Ответ «Нет» дан. Дополнительные сведения не требуются.</Notice>}
  </Panel><SavePayments m={m} /></div><div className="fp-stack"><Panel className="fp-explain-card"><span className="fp-explain-symbol"><CalendarDays size={25} /></span><h2>Две разные даты</h2><p>Деньги могут поступить после окончания службы, но относиться к периоду её прохождения.</p>
    <Notice tone="teal">Это не прямое противоречие. Сопоставляются период основания и документ, а не только день перечисления.</Notice></Panel>
    <Notice tone="neutral"><strong>Документ — при наличии.</strong><br />Для этой категории не требуется банковская справка.</Notice></div></div></>
}

export function SupportScreen(m: ProfileModel) {
  return <><BackToPayments m={m} /><div className="fp-columns fp-form-columns"><div className="fp-stack"><Panel><PanelTitle title="Ответы по уровням поддержки" />
    {Object.entries(m.supportLevels).map(([level, answer]) => <div className="fp-level-row" key={level}><span><Landmark size={18} />{level} уровень поддержки</span><Choice value={answer} onChange={(value) => m.setSupportLevel(level, value)} /></div>)}
  </Panel><Panel><PanelTitle title="Полученные меры" />{m.categoryAnswers[3] === 'Да' ? <PaymentRecords m={m} category={3} /> : <Notice tone="teal">По всем уровням дан ответ «Нет». Дополнительные поля закрыты.</Notice>}</Panel><SavePayments m={m} /></div>
    <div className="fp-stack"><Notice tone={m.completeness.support ? 'blue' : 'red'}><strong>Для полученной меры документ обязателен.</strong><br />НПА, решение органа назначения или справка уполномоченного органа. Не банковская выписка.</Notice>
      <Panel><PanelTitle title="Как заполнить источник" /><p>Указывайте орган назначения меры. Отсутствующий ответ внешнего источника не означает, что поддержки не было.</p><Badge tone="neutral">Ведомственные источники не подключены</Badge></Panel></div>
  </div></>
}

export function InsuranceScreen(m: ProfileModel) {
  return <><BackToPayments m={m} /><div className="fp-columns fp-form-columns"><div className="fp-stack">
    <Panel><PanelTitle title="Личные страховые выплаты и компенсации" /><div className="fp-question"><strong>Получали ли вы выплату в связи с личным участием?</strong><Choice value={m.personalInsuranceAnswer} onChange={m.setPersonalInsuranceAnswer} /></div>
      {m.personalInsuranceAnswer === 'Да' ? <PaymentRecords m={m} category={4} recipientKind="Сам резервист" /> : <Notice tone="neutral">Дополнительные поля личной выплаты закрыты.</Notice>}</Panel>
    <Panel><PanelTitle title="Выплаты за родственника — участника СВО" action={<Badge tone="blue"><Link2 size={13} />Связанные сведения</Badge>} />
      {m.relativeAnswer === 'Да' ? <><div className="fp-question"><strong>Получали ли вы выплату за родственника?</strong><Choice value={m.kinship.receivedPayments} onChange={(value) => m.updateKinship('receivedPayments', value)} /></div>
        {m.kinship.receivedPayments === 'Да' && <><div className="fp-recipient-chain"><div><span>ПОЛУЧАТЕЛЬ</span><strong>{m.candidate.fullName}</strong><small>Кандидат в резерв</small></div><ArrowRight size={19} /><div><span>СВЯЗЬ</span><strong>{m.kinship.fullName}</strong><small>{m.kinship.degree} · {m.kinship.status}</small></div></div>
          <PaymentRecords m={m} category={4} recipientKind="Резервист за родственника" /></>}
      </> : <Notice tone="neutral">Родство не указано. Сведения о выплатах за родственника не запрашиваются.</Notice>}
    </Panel><SavePayments m={m} />
  </div><div className="fp-stack"><Panel className="fp-explain-card"><span className="fp-explain-symbol"><Link2 size={25} /></span><h2>Получатель ≠ основание</h2><p>Выплату получил кандидат в резерв, но право на неё может быть связано с родственником. Сохраняйте эту связь отдельно.</p></Panel>
    <Notice tone="amber">Сверьте выбранное основание с документом. Несовпадение — вопрос для уточнения, не автоматический отказ в назначении.</Notice></div></div></>
}

export function HousingScreen(m: ProfileModel) {
  return <><BackToPayments m={m} /><div className="fp-columns fp-form-columns"><div className="fp-stack"><Panel><PanelTitle title="Состояние жилищной меры" />
    <div className="fp-question"><strong>Предоставлялась ли вам жилищная мера?</strong><Choice value={m.housingAnswer} onChange={m.setHousingAnswer} planned /></div>
    {m.housingAnswer === 'Нет' ? <Notice tone="teal">Дополнительные поля закрыты. Ответ по категории дан.</Notice> : <>
      {m.housingAnswer === 'Планируется' && <Notice>Планируемая мера указывается только при наличии документа-основания, в том числе на этапе очереди на 1–3 года.</Notice>}
      <PaymentRecords m={m} category={8} />
    </>}
  </Panel><Panel><PanelTitle title="Учитывается не как полученный доход" /><div className="fp-housing-visual"><span><Home size={29} /></span><div><strong>Жилищная мера → отдельная запись</strong><p>План, субсидия, кредит и предоставление жилья не объединяются в одну денежную выплату.</p></div><Badge tone="blue">Не суммировать автоматически</Badge></div></Panel><SavePayments m={m} /></div>
    <div className="fp-stack"><Panel className="fp-privacy-card"><Home size={29} /><h2>Готовимся заранее</h2><p>Укажите уже оформленное основание, даже если получение жилья ожидается через несколько лет.</p><div className="fp-privacy-line"><CalendarDays size={17} />Год — предполагаемый, не дата выплаты</div></Panel>
      <Notice tone="neutral">Банковские выписки и справки по счетам сюда не прикрепляются.</Notice></div></div></>
}

export function ActivitiesScreen(m: ProfileModel) {
  const military = m.servicePeriods.find((row) => row.kind === 'Военная служба')
  const activity = m.activities[0]
  return <div className="fp-columns fp-form-columns"><div className="fp-stack"><Panel><PanelTitle eyebrow="ЭТАП 90%" title="Экспертная и преподавательская работа" />
    <div className="fp-question"><strong>Участвуете ли вы в такой деятельности?</strong><Choice value={m.activityAnswer} onChange={m.setActivityAnswer} /></div>
    {m.activityAnswer === 'Да' ? <><div className="fp-record-list">{m.activities.map((row, index) => <fieldset className="fp-record-editor" key={row.id}>
      <legend>Деятельность {index + 1}</legend><DataFields m={m} fields={activityFields} values={row} onChange={(key, value) => m.updateActivity(row.id, key, value)}
        onUpload={(_key, name, file) => m.attachActivityDocument(row.id, name, file)} />
      <button className="fp-text-button fp-delete-record" aria-label={`Удалить деятельность ${index + 1}`} onClick={() => m.removeActivity(row.id)}><Trash2 size={15} />Удалить деятельность</button>
    </fieldset>)}</div><button className="fp-text-button" onClick={m.addActivity}><Plus size={15} />Добавить деятельность</button></>
      : <Notice tone="teal">Ответ «Нет» дан. Поля дополнительной деятельности закрыты.</Notice>}
  </Panel>
    {m.activityAnswer === 'Да' && military && activity && <Panel><PanelTitle title="Периоды рядом" subtitle="Пересечение помогает сформулировать вопрос, а не обвинение" />
      <div className="fp-period-chart"><div><span>Основная служба</span><div><i className="fp-period-service">{dateText(military.start)} — {dateText(military.end) || 'по настоящее время'}</i></div></div>
        <div><span>{activity.kind}</span><div><i className="fp-period-teaching">{dateText(activity.periodFrom)} — {dateText(activity.periodTo) || 'по настоящее время'}</i></div></div></div>
      <Notice tone="amber">Применимость уведомления и правовые условия оценивает специалист. Само пересечение периодов не является выводом о нарушении.</Notice></Panel>}
  </div><div className="fp-stack"><Panel className="fp-explain-card"><span className="fp-explain-symbol"><GraduationCap size={26} /></span><h2>Что сопоставляется</h2><ul className="fp-check-points">
    <li><Check size={16} />Организация в анкете и договоре</li><li><Check size={16} />Вид оформления и документ-основание</li><li><Check size={16} />Даты деятельности и службы</li></ul><p>В макете нет юридического решения от ИИ.</p></Panel>
    <Notice tone="neutral">Безвозмездная деятельность не превращается в денежную выплату автоматически.</Notice></div></div>
}

function ConsentPanel({ m }: { m: ProfileModel }) {
  return <Panel><PanelTitle title="Подписанное согласие на обработку персональных данных" action={<Badge tone={m.consentDocument ? 'teal' : 'red'}>{m.consentDocument ? 'Файл приложен' : 'Обязательно'}</Badge>} />
    <Notice tone="neutral">Используйте форму действующего оператора. Подписанный скан обязателен; галочка передачи версии его не заменяет. Наличие и содержание подписи проверяет кадровый специалист.</Notice>
    {m.consentDocument && <FileRow name={m.consentDocument.name} url={m.consentDocument.url} note="Скан согласия · подпись автоматически не проверена" onPreview={m.showDocument} onDownload={m.recordDownload} />}
    {m.editable && <UploadBox label="Подписанный скан согласия на обработку ПДн" mode="scan" error={!m.consentDocument} onUpload={m.attachConsent} />}
    {m.editable && !m.consentDocument && <button className="fp-text-button" onClick={() => m.attachConsent(CONSENT_SAMPLE)}>Добавить учебный скан</button>}
    <small className="fp-footnote">Учебный файл содержит вымышленную подпись. Он не является согласием реального человека.</small>
  </Panel>
}

export function DocumentsScreen(m: ProfileModel) {
  const reviewer = m.role === 'reviewer'
  const selected = m.visibleAttachments.find((file) => file.id === m.selectedDocument)
  const currentAssessment = m.presented ? m.documentAssessments[`${m.presented.version}:${m.selectedDocument}`] : null
  return <>
    <Notice icon={<ShieldCheck size={19} />}><strong>Техническая проверка не заменяет оценку документа.</strong> При загрузке проверяются формат, размер и сигнатура контейнера. Читаемость, полноту страниц, подпись и соответствие основанию оценивает человек. OCR и проверка подлинности не выполняются.</Notice>
    <div className="fp-columns fp-documents-columns"><div className="fp-stack">
      {!reviewer && !m.reviewerClosed && <ConsentPanel m={m} />}
      <Panel><PanelTitle title={reviewer ? 'Документы представленной версии' : 'Файлы и связанные разделы'} subtitle={`${m.documentCount} документов · ${reviewer ? 'неизменный комплект' : 'личный черновик'}`} />
        <div className="fp-document-table">{m.visibleAttachments.map((file) => {
          const assessment = m.presented ? m.documentAssessments[`${m.presented.version}:${file.id}`] : null
          return <div className="fp-file-card" key={file.id} data-document-id={file.id}>
            <FileRow name={file.name} url={file.url} note={`${file.section} · ${file.format.toUpperCase()} · ${Math.max(1, Math.round(file.size / 1024))} КБ · ${file.origin === 'sample' ? 'учебный файл' : 'формат и размер проверены'}`} onPreview={m.showDocument} onDownload={m.recordDownload} />
            <div className="fp-file-card-actions">{assessment ? <div className="fp-document-assessment"><Badge tone={assessment.status === 'Пригоден для сопоставления' ? 'teal' : 'amber'}>{assessment.status}</Badge><p>{assessment.comment}</p><small>{assessment.author} · версия {assessment.version}</small></div>
              : <Badge tone="neutral">Содержание не оценено</Badge>}
              {reviewer ? <button className="fp-text-button" onClick={() => m.chooseDocument(file.id)}>Оценить документ<ChevronRight size={14} /></button>
                : m.editable && <button className="fp-text-button fp-delete-record" aria-label={`Удалить ${file.name}`} onClick={() => m.removeAttachment(file.id)}><Trash2 size={15} />Удалить</button>}
            </div>
          </div>
        })}</div>
        {!reviewer && m.editable && <UploadBox label="Дополнительный документ основания" optional onUpload={m.addAttachment} />}
      </Panel>
    </div><div className="fp-stack">
      {reviewer ? <Panel className="fp-document-review-form"><PanelTitle title="Оценка качества документа" subtitle={selected?.name || 'Выберите документ в списке'} />
        {selected && <>
          {currentAssessment && <Notice tone="blue">Предыдущая оценка сохранена с комментарием. Новая оценка будет отдельным событием журнала.</Notice>}
          <Field label="Оценка документа" value={m.documentStatus} options={['Пригоден для сопоставления', 'Нужна конкретика', 'Нечитаемый или неполный скан']} onChange={(value) => m.setDocumentStatus(value as DocumentAssessment['status'])} />
          <label className="fp-field"><span className="fp-field-label">Комментарий к документу<em aria-hidden="true"> *</em></span><textarea aria-label="Комментарий к документу" maxLength={4000} value={m.documentComment} onChange={(e) => m.setDocumentComment(e.target.value)} rows={4} placeholder="Укажите, что проверили, либо какую страницу / реквизит нужно уточнить…" /></label>
          <div className="fp-document-review-actions"><button className="fp-button" disabled={m.reviewReadOnly || m.documentComment.trim().length < 5} onClick={m.assessDocument}>Сохранить оценку</button>
            <button className="fp-button fp-button-outline" disabled={m.reviewReadOnly || m.documentComment.trim().length < 5} onClick={m.clarifyDocument}>Запросить уточнение по документу</button></div>
          <small className="fp-footnote">Оценка не устанавливает нарушение и сама по себе не меняет статус анкеты. Уточнение запрашивается отдельной кнопкой.</small>
        </>}
      </Panel> : <>
        <Panel><PanelTitle title="Источники сведений" /><div className="fp-source-row"><FileText size={20} /><div><strong>Ручная загрузка</strong><small>Документы кандидата в резерв</small></div><Badge tone="teal">Доступна</Badge></div>
          <Notice tone="neutral"><strong>Сведения не получены</strong><br />Нет ответа ведомственного источника ≠ нет дохода или выплаты.</Notice></Panel>
        <Panel><PanelTitle title="Когда справка не нужна" /><p>Пенсии и социальные выплаты — только «Да / Нет». Документ единовременной выплаты — при наличии.</p></Panel>
        <button className="fp-button fp-full" onClick={() => m.navigate('selfcheck')}>Проверить комплект<ArrowRight size={16} /></button>
      </>}
      <Panel><PanelTitle title="Памятки и заготовки" /><p>Помогут собрать сведения и проверить скан. Не заменяют официальную форму региональной выплаты.</p>
        <button className="fp-text-button" onClick={() => m.navigate('templates')}>Открыть библиотеку<ArrowRight size={15} /></button></Panel>
    </div></div>
  </>
}

export function SelfCheckScreen(m: ProfileModel) {
  const locked = m.sent && m.phase !== 'clarification'
  const report = locked && m.presented ? assessContent(m.presented) : m.selfCheckReport
  const documents = locked && m.presented ? m.presented.documentCount : m.documentCount
  const records = locked && m.presented ? Array.from({ length: 10 }, (_, category) => activeRecords(m.presented!, category).length).reduce((a, b) => a + b, 0) : m.recordCount
  const scanPresent = locked ? !!m.presented?.consentDocumentId : !!m.consentDocument
  return <>
    <div className={`fp-readiness ${report.missing === 0 ? 'fp-readiness-ready' : ''}`}><span className="fp-readiness-icon">{report.missing === 0 ? <CheckCircle2 size={32} /> : <ClipboardCheck size={32} />}</span>
      <div><h2>{locked ? 'Версия передана на рассмотрение' : 'Комплектность сведений'}</h2><p>{locked ? 'Проверяющему доступна только отправленная версия.' : 'Проверьте полноту и достоверность представленных сведений.'}</p></div>
      <div className="fp-readiness-score" aria-label={`Готово ${report.completed} из 7 блоков`}><strong>{report.completed}<small> / 7</small></strong><span>блоков готовы</span></div>
      {!locked && <button className="fp-refresh-button" aria-label="Повторить самопроверку" title="Проверить снова" onClick={m.repeatSelfCheck}><RotateCw size={22} /></button>}
    </div>
    <div className="fp-columns fp-form-columns"><div className="fp-stack"><Panel><PanelTitle title="Обязательные сведения" /><div className="fp-checklist">
      {report.rows.map((row) => <div key={row.title} className={`fp-check-row ${row.issues.length ? 'error' : 'ok'}`}><span>{row.issues.length ? <AlertCircle size={18} /> : <Check size={18} />}</span>
        <div><strong>{row.title}</strong><small>{row.issues[0] || 'Обязательные сведения заполнены'}</small>{row.issues.length > 1 && <small>Ещё замечаний к заполнению: {row.issues.length - 1}</small>}</div>
        {row.issues.length ? <button className="fp-text-button" onClick={() => m.navigate(row.screen)}>Исправить<ChevronRight size={14} /></button> : <Badge tone="teal">Готово</Badge>}
      </div>)}
    </div></Panel><button className="fp-text-button fp-instruction-link" onClick={() => m.navigate('instructions')}><BookOpen size={16} />Требования к документам и исключения<ArrowRight size={14} /></button></div>
      <Panel className="fp-submit-card"><PanelTitle title={locked ? 'Представленная версия' : 'Передача сведений'} eyebrow={`ВЕРСИЯ ${locked ? m.presented?.version : m.workingVersion}`} />
        <div className="fp-key-row"><span>Ответов по блокам</span><strong>{report.answers} / 10</strong></div>
        <div className="fp-key-row"><span>Записей и мер</span><strong>{records}</strong></div>
        <div className="fp-key-row"><span>Документов</span><strong>{documents}</strong></div>
        <div className="fp-key-row"><span>Скан согласия</span><strong>{scanPresent ? 'Приложен' : 'Не приложен'}</strong></div>
        <div className="fp-divider" />
        {locked ? <><Badge tone="teal"><CheckCircle2 size={14} />{m.profileStatus}</Badge><p>Версия {m.presented?.version} зафиксирована {m.presented?.createdAt}.</p>
          <button className="fp-button fp-button-outline fp-full" onClick={() => m.navigate('messages')}>Статус и уточнения<ArrowRight size={16} /></button></>
          : <><label className="fp-checkbox"><input type="checkbox" checked={m.consent} onChange={(e) => m.setConsent(e.target.checked)} /><span>Я проверил сведения и подтверждаю передачу этой версии уполномоченному специалисту</span></label>
            <button className="fp-button fp-full" onClick={m.submit} disabled={!m.ready || !m.consent}><Send size={16} />Отправить на проверку</button>
            <small className="fp-submit-note"><LockKeyhole size={13} />Личный черновик и подсказки не передаются</small>
            {!m.consentDocument && <p>Сначала приложите подписанный скан согласия. Галочка выше не заменяет документ.</p>}</>}
      </Panel>
    </div>
  </>
}

export function QueueScreen(m: ProfileModel, onQuickLogin?: () => void) {
  const statusText = (status: string) => ['submitted', 'resubmitted'].includes(status) ? 'Поступило'
    : status === 'accepted' ? 'Принят к рассмотрению' : status === 'clarification' ? 'Требуется уточнение'
      : status === 'removed' ? 'Снят с рассмотрения' : 'Рассмотрение завершено'
  const items = m.queueItems.filter((item) => `${item.full_name} ${item.profile_id} ${item.program}`.toLowerCase().includes(m.query.trim().toLowerCase())
    && (m.queueFilter === 'Все' || (m.queueFilter === 'На уточнении' ? item.status === 'clarification'
      : m.queueFilter === 'Завершено' ? ['completed', 'removed'].includes(item.status) : statusText(item.status) === m.queueFilter)))
  return <>
    <div className="fp-stats">
      {[[Inbox, m.queueItems.length, 'назначено вам', 'blue'], [Send, m.queueItems.filter((item) => ['submitted', 'resubmitted'].includes(item.status)).length, 'новых материалов', 'teal'],
        [MessageSquareText, m.queueItems.filter((item) => item.status === 'clarification').length, 'на уточнении', 'amber'], [BadgeCheck, m.queueItems.filter((item) => ['completed', 'removed'].includes(item.status)).length, 'рассмотрение завершено', 'neutral']].map(([Icon, count, title, tone]) => {
        const StatIcon = Icon as typeof Inbox
        return <Panel className="fp-stat" key={String(title)}><span className={`fp-stat-icon fp-${tone}`}><StatIcon size={23} /></span><div><strong>{String(count)}</strong><span>{String(title)}</span></div></Panel>
      })}
    </div>
    <Panel className="fp-queue-panel"><PanelTitle title="Назначенные материалы" subtitle="Только отправленные комплекты; черновики и статические заглушки не учитываются" action={
      <label className="fp-search"><Search size={18} /><input aria-label="Поиск материалов" placeholder="ФИО или номер профиля" value={m.query} onChange={(e) => m.setQuery(e.target.value)} /></label>} />
      <div className="fp-table-tabs">{['Все', 'Поступило', 'Принят к рассмотрению', 'На уточнении', 'Завершено'].map((tab) => <button key={tab} className={tab === m.queueFilter ? 'active' : ''} onClick={() => m.setQueueFilter(tab)}>{tab}{tab === 'Все' && <span>{m.queueItems.length}</span>}</button>)}</div>
      <div className="fp-table-scroll"><table className="fp-table"><thead><tr><th>Профиль</th><th>Кандидат в резерв</th><th>Представлено / период</th><th>Сопоставление</th><th>Статус</th><th /></tr></thead>
        <tbody>{items.length ? items.map((item) => <tr key={item.profile_id}><td><strong className="fp-table-id" title={item.profile_id}>ФП-{item.profile_id.slice(0, 8)}</strong><small>Версия {item.version_number}</small></td>
          <td><div className="fp-table-person"><span className="fp-avatar">{item.full_name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('')}</span><div><strong>{item.full_name}</strong><small>{item.program} · {item.program_year}</small></div></div></td>
          <td>{timeText(item.submitted_at)}<small>{item.reporting_period}</small>{item.is_demo && <Badge tone="neutral">Учебный комплект</Badge>}</td>
          <td><Badge tone={item.pending_signals ? 'amber' : 'blue'}>{item.pending_signals} нерассмотренных сигналов</Badge></td>
          <td><Badge tone={['completed', 'removed'].includes(item.status) ? 'teal' : item.status === 'clarification' ? 'amber' : 'blue'}>{statusText(item.status)}</Badge></td>
          <td><button className="fp-icon-button" disabled={m.busy} aria-label={`Открыть ${item.profile_id}`} onClick={() => m.openMaterial(item.profile_id)}><ChevronRight size={18} /></button></td></tr>)
          : <tr><td colSpan={6}><div className="fp-empty fp-empty-queue"><Inbox size={30} /><h2>{m.queueItems.length ? 'Материалы не найдены' : 'Нет поступивших материалов'}</h2><p>{m.queueItems.length ? 'Измените поиск или фильтр.' : 'Материал появится после отправки кандидатом в резерв и назначения доступа.'}</p></div></td></tr>}</tbody>
      </table></div><div className="fp-table-footer"><span>Показано {items.length} из {m.queueItems.length} · только вымышленные сведения</span><span>Серверная очередь</span></div>
    </Panel>
    <div className="fp-columns fp-queue-bottom"><Notice icon={<LockKeyhole size={20} />}><strong>Черновики не поступают в очередь.</strong><br />
      Материал появляется только после отправки кандидатом в резерв и назначения вам доступа.
      <div className="fp-queue-hint"><span>Для показа можно открыть отдельный готовый учебный комплект. Он не заменяет материалы очереди и не использует личный черновик.</span>
        <button className="fp-button fp-button-outline" disabled={m.busy} onClick={m.loadDemoMaterial}><Upload size={15} />Открыть демо-комплект</button>
        {onQuickLogin && <button className="fp-text-button" onClick={onQuickLogin}><UserRound size={15} />Войти как кандидат в резерв</button>}</div>
    </Notice><Panel><PanelTitle title="Порядок приёма" /><div className="fp-inline-steps"><span><i>1</i>Комплектность</span><ChevronRight size={15} /><span><i>2</i>Сопоставление</span><ChevronRight size={15} /><span><i>3</i>Обоснованный статус</span></div></Panel></div>
  </>
}

export function CaseScreen(m: ProfileModel) {
  if (!m.presented) return null
  const content = m.presented
  const military = content.servicePeriods.find((period) => period.kind === 'Военная служба')
  const scan = content.attachments.find((file) => file.id === content.consentDocumentId)
  const reviewed = m.reviewedSignals(content.version)
  const report = assessContent(content)
  const laterPayment = activeRecords(content, 2).find((row) => military?.end && row.paymentDate > military.end && row.periodTo <= military.end)
  return <>
    <button className="fp-back" onClick={() => m.navigate('queue')}><ArrowLeft size={15} />К очереди материалов</button>
    <LegacyDetails content={content} />
    <PersonHeader profileId={m.profileId} status={m.profileStatus} tone={m.phase === 'clarification' ? 'amber' : 'teal'} version={`представленная версия ${content.version}`} details={content.candidate} photo={content.photo}>
      <div className="fp-case-counters"><div><span>Документов</span><strong>{m.documentCount}</strong></div><div><span>Рассмотрено v{content.version}</span><strong>{reviewed}<small> / {m.currentSignals.length}</small></strong></div></div>
      <button className="fp-button" disabled={m.reviewerClosed} onClick={() => {
        if (m.accepted) { m.chooseSignalVersion(content.version); m.navigate('signals') }
        else { m.setDecisionStatus('Принят к рассмотрению'); m.navigate('result') }
      }}>{m.accepted ? 'Сопоставить' : 'Принять к рассмотрению'}<ArrowRight size={16} /></button>
    </PersonHeader>
    <div className="fp-case-nav"><button className="active">Обзор материала</button><button onClick={() => m.navigate('documents')}>Документы и качество</button>
      <button onClick={() => m.navigate('signals')}>Карточка сигналов<Badge tone="amber">{m.currentSignals.length}</Badge></button><button onClick={() => m.navigate('history')}>История версий</button><button onClick={() => m.navigate('result')}>Результат рассмотрения</button>
      <span><LockKeyhole size={14} />Только представленная версия</span></div>
    <div className="fp-columns fp-case-columns"><div className="fp-stack"><Panel><PanelTitle title={m.accepted ? 'Материал принят к рассмотрению' : 'Представленные сведения'} action={<Badge tone={report.missing ? 'amber' : 'teal'}><Check size={13} />{report.missing ? 'Историческая неполная версия' : 'Полный комплект'}</Badge>} />
      <div className="fp-case-facts"><div><span>Текущая работа</span><strong>{content.candidate.workplace}</strong></div><div><span>Статус</span><strong>{content.candidate.workStatus}</strong></div>
        <div><span>Период представляемых сведений</span><strong>{content.candidate.reportingPeriod}</strong></div><div><span>Периоды службы / работы</span><strong>{content.servicePeriods.map((period) => `${dateText(period.start)} — ${dateText(period.end) || 'настоящее время'}`).join('; ')}</strong></div>
        <div><span>Родство с участником СВО</span><strong>{content.relativeAnswer === 'Да' ? `Да · ${content.kinship.degree.toLowerCase()} · ${content.kinship.status.toLowerCase()}` : 'Нет'}</strong></div>
        <div><span>Получал за родственника</span><strong>{content.relativeAnswer === 'Да' ? content.kinship.receivedPayments : 'Не применимо'}</strong></div>
        <div className="fp-case-fact-wide"><span>Предполагаемый орган назначения</span><strong>{content.candidate.appointmentAuthority || 'Не указан'}</strong></div></div>
      <div className="fp-completeness-strip"><span><CheckCircle2 size={16} />{report.answers} из 10 ответов даны</span><span><CheckCircle2 size={16} />{report.completed} из 7 обязательных блоков заполнены</span></div>
    </Panel>
      <Panel><PanelTitle title="Согласие кандидата" subtitle={content.transferConfirmedAt ? `Подтверждение передачи версии: ${content.transferConfirmedAt}` : 'В старой версии подтверждение передачи отдельно не сохранялось'} />
        {scan && <FileRow name={scan.name} url={scan.url} note="Подписанный скан согласия на обработку ПДн · подпись требует ручной проверки" required onPreview={m.showDocument} onDownload={m.recordDownload} />}
        <button className="fp-text-button" onClick={() => { if (scan) m.chooseDocument(scan.id); m.navigate('documents') }}>Проверить читаемость и подпись<ArrowRight size={15} /></button>
      </Panel>
      <Panel><PanelTitle title="Представленные сведения о доходах" subtitle="Суммы введённых записей, не подтверждённый доход для «Справок БК»" />
        <div className="fp-financial-cards"><div><span className="fp-financial-icon fp-teal"><UserRound size={21} /></span><small>Денежные записи кандидата в резерв</small><strong>{m.summary.personal}<span> ₽</span></strong><p>{m.summary.personalRecords} записей · возможный дубль автоматически не вычитается</p></div>
          <div><span className="fp-financial-icon fp-blue"><UsersRound size={21} /></span><small>Отдельно: член семьи</small><strong>{m.summary.family}<span> ₽</span></strong><p>Не личный доход кандидата в резерв</p></div></div>
        <div className="fp-noncash-row">{activeRecords(content, 8).map((row) => <div key={row.id}><Home size={21} /><span><strong>Жилищная мера · {content.categoryAnswers[8] === 'Планируется' ? `планируется в ${row.expectedYear}` : row.housingKind}</strong><small>{row.basis} · отдельная мера</small></span></div>)}
          {activeRecords(content, 7).filter((row) => row.form === 'Натуральная').map((row) => <div key={row.id}><BriefcaseBusiness size={21} /><span><strong>Помощь фонда · натуральная форма</strong><small>{row.description} · отдельно от денежных выплат</small></span></div>)}</div>
      </Panel>
    </div><div className="fp-stack"><Panel className="fp-question-card"><PanelTitle title="Вопросы для уточнения" action={<span className="fp-count-bubble">{m.currentSignals.length}</span>} />
      {m.currentSignals.map((signal) => <button className="fp-mini-signal" key={signal.code} onClick={() => { m.chooseSignalVersion(content.version); m.setSelectedSignal(signal.index); m.navigate('signals') }}><div><small>{signal.code}</small><strong>{signal.title}</strong>
        <Badge tone={m.signalDecision(signal.code, content.version)?.status === 'Рассмотрено' ? 'teal' : 'amber'}>{m.signalDecision(signal.code, content.version)?.status || 'Не рассмотрено'}</Badge></div><ChevronRight size={15} /></button>)}
      {!m.currentSignals.length && <p>Сигналов по введённым полям не сформировано. Документы всё равно требуют оценки специалиста.</p>}
    </Panel>
      {laterPayment && <Notice tone="blue">Дата перечисления {dateText(laterPayment.paymentDate)} позднее окончания службы. Период основания заканчивается {dateText(laterPayment.periodTo)} — прямое противоречие дат не сформировано.</Notice>}
      <button className="fp-button fp-button-outline fp-full" onClick={() => m.navigate('result')}>Зафиксировать результат<ArrowRight size={16} /></button>
    </div></div>
  </>
}

export function SignalsScreen(m: ProfileModel) {
  const signal = m.signals.find((item) => item.index === m.selectedSignal) || m.signals[0]
  const decision = signal ? m.signalDecision(signal.code) : null
  const reviewed = m.reviewedSignals()
  const versionSelector = m.versions.length > 1 && <Field label="Версия сигналов" value={String(m.signalVersion)}
    options={m.versions.map((version) => ({ value: String(version.version), label: `Представленная версия ${version.version}` }))}
    onChange={(value) => m.chooseSignalVersion(Number(value))} />
  if (!signal) return <>{versionSelector}<Panel className="fp-empty"><CheckCircle2 size={34} /><h2>Сигналов по полям анкеты нет</h2><p>Это не подтверждение качества сканов и не решение о назначении. Документы оценивает специалист.</p>
    <button className="fp-button" onClick={() => m.navigate('documents')}>Посмотреть документы<ArrowRight size={16} /></button></Panel>
  </>
  return <>
    {versionSelector}
    <div className="fp-material-strip"><div><span className="fp-avatar">К</span><div><strong>{m.visibleCandidate.fullName}</strong><small>{m.profileId} · представленная версия {m.signalVersion} · сигналы по полям анкеты</small></div></div><Badge tone="blue">Рассмотрено {reviewed} из {m.signals.length}</Badge></div>
    {m.historicalSignals && <Notice tone="blue">Показаны исходные вопросы версии {m.signalVersion}. Новая версия не переписывает прежние основания и комментарии.</Notice>}
    <div className="fp-signal-layout"><div className="fp-stack"><div className="fp-list-caption">ВОПРОСЫ ПО МАТЕРИАЛУ<span>{m.signals.length}</span></div>
      {m.signals.map((item) => <button className={`fp-signal-item ${signal.index === item.index ? 'active' : ''}`} key={item.code} onClick={() => { m.setSelectedSignal(item.index); m.setReviewComment('') }}>
        <span className="fp-signal-item-code">{item.code}<small>{item.type}</small></span><h2>{item.title}</h2><div><Badge tone={m.signalDecision(item.code)?.status === 'Рассмотрено' ? 'teal' : 'amber'}>{m.signalDecision(item.code)?.status || 'Не рассмотрено'}</Badge><span>2 основания<ChevronRight size={14} /></span></div>
      </button>)}
      <Notice tone="neutral">Сигнал, в том числе «включённый», не означает признания нарушения. Включение и исключение требуют комментария.</Notice>
    </div><Panel className="fp-signal-detail"><PanelTitle eyebrow={`${signal.code} · ПРАВИЛО СОПОСТАВЛЕНИЯ`} title={signal.title} action={<span className="fp-detail-mark"><Link2 size={22} /></span>} />
      <div className="fp-review-reason"><AlertCircle size={21} /><div><strong>Основание для уточнения</strong><p>{signal.text}</p></div></div>
      <div className="fp-evidence-grid">{[[signal.leftTitle, signal.left], [signal.rightTitle, signal.right]].map(([title, rows], index) => <article key={String(title)} className={index ? 'fp-evidence-document' : ''}>
        <span className="fp-evidence-label">{index ? 'СОПОСТАВЛЯЕМЫЕ СВЕДЕНИЯ' : 'ПРЕДСТАВЛЕННАЯ ЗАПИСЬ'}</span><h3>{String(title)}</h3><dl>{(rows as string[][]).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || 'Не указано'}</dd></div>)}</dl>
      </article>)}</div>
      <div className="fp-document-quote"><FileText size={18} /><div><span>Ограничение автоматической проверки</span><blockquote>{signal.quote}</blockquote></div></div>
      <div className="fp-review-followup"><strong>Что сопоставить</strong><p>{signal.action}</p></div>
      {decision && <div className="fp-review-record"><div><Badge tone={decision.status === 'Рассмотрено' ? 'teal' : 'blue'}>{decision.status}</Badge><small>{decision.author} · версия {m.signalVersion}</small></div><p>{decision.comment}</p></div>}
      <div className="fp-decision-form"><h3>Результат сопоставления</h3><label className="fp-field"><span className="fp-field-label">Комментарий и вопрос кандидату в резерв<em aria-hidden="true"> *</em></span><textarea aria-label="Комментарий и вопрос кандидату в резерв" maxLength={2000} value={m.reviewComment} onChange={(e) => m.setReviewComment(e.target.value)} rows={3} placeholder="Укажите сопоставленные сведения и конкретный вопрос…" /></label>
        <div className="fp-decision-actions"><button className="fp-button" disabled={m.signalReadOnly || m.reviewComment.trim().length < 5} onClick={m.requestClarification}><MessageSquareText size={16} />Запросить уточнение</button>
          <button className="fp-button fp-button-outline" disabled={m.signalReadOnly || m.reviewComment.trim().length < 5} onClick={() => m.recordSignalDecision('Рассмотрено')}><CheckCircle2 size={15} />Отметить рассмотренным</button>
          <button className="fp-text-button" disabled={m.signalReadOnly || m.reviewComment.trim().length < 5} onClick={() => m.recordSignalDecision('Исключено с обоснованием')}>Исключить вопрос</button>
          <button className="fp-text-button" disabled={m.signalReadOnly || m.reviewComment.trim().length < 5} onClick={() => m.recordSignalDecision('Включён с комментарием')}>Включить сигнал</button></div>
        <small>Отметка фиксирует работу специалиста, но не решение о назначении.</small>
      </div>
    </Panel></div>
  </>
}

export function MessagesScreen(m: ProfileModel) {
  const reply = m.role === 'reservist' && m.phase === 'clarification' ? m.privateReply : m.presented?.reply || ''
  if (!m.question) return <Panel className="fp-empty"><span className="fp-empty-icon"><MessageSquareText size={34} /></span><h2>Запросов уточнения пока нет</h2><p>{m.sent ? 'Вопрос специалиста появится здесь вместе с указанием версии.' : 'Сначала завершите профиль и отправьте сведения на проверку.'}</p>
    <button className="fp-button" onClick={() => m.navigate(m.role === 'reservist' ? 'selfcheck' : 'signals')}>Продолжить<ArrowRight size={16} /></button></Panel>
  return <>
    <div className="fp-material-strip"><div><span className="fp-avatar">К</span><div><strong>{m.visibleCandidate.fullName}</strong><small>{m.profileId} · рабочее уточнение по представленным сведениям</small></div></div><Badge tone={m.phase === 'clarification' ? 'amber' : 'teal'}>{m.profileStatus}</Badge></div>
    <div className="fp-columns fp-message-columns"><div className="fp-stack"><Panel><PanelTitle title="Вопрос уполномоченного специалиста" subtitle={m.questionAuthor} action={<Badge tone="blue">Представленная версия</Badge>} />
      <div className="fp-formal-question"><MessageSquareText size={23} /><p>{m.question}</p></div>
    </Panel>
      {m.role === 'reservist' && m.phase === 'clarification' ? <Panel><PanelTitle title="Ответ и уточнённые сведения" subtitle={`Изменения сохраняются в личном черновике версии ${m.workingVersion}`} />
        <label className="fp-field"><span className="fp-field-label">Пояснение кандидата в резерв<em aria-hidden="true"> *</em></span><textarea aria-label="Пояснение кандидата в резерв" maxLength={4000} value={reply} rows={4} onChange={(e) => m.setReply(e.target.value)} placeholder="Поясните основание и внесённые исправления…" /></label>
        <div className="fp-correction-links"><button className="fp-text-button" onClick={() => m.navigate('payments')}>Изменить выплаты<ArrowRight size={14} /></button>
          <button className="fp-text-button" onClick={() => m.navigate('documents')}>Проверить документы<ArrowRight size={14} /></button>
          <button className="fp-text-button" onClick={() => m.navigate('profile')}>Изменить анкету<ArrowRight size={14} /></button></div>
        <small className="fp-footnote">Исправьте нужные поля или замените файл в соответствующем разделе. Подготовка версии не удаляет записи и не изменяет основания автоматически.</small>
        <button className="fp-button" disabled={reply.trim().length < 10} onClick={m.prepareCorrection}>Подготовить версию {m.workingVersion}<ArrowRight size={16} /></button>
      </Panel> : <Panel><PanelTitle title={`Пояснение в представленной версии ${m.presented?.version}`} />{reply ? <><p className="fp-reply-text">{reply}</p><Badge tone="teal">Версия {m.presented?.version} представлена</Badge></>
        : <div className="fp-waiting"><Clock3 size={22} /><div><strong>Ожидается ответ и новая версия</strong><p>Изменения в черновике кандидата в резерв вам недоступны.</p></div></div>}</Panel>}
      <Panel><PanelTitle title="История отправленных сообщений" subtitle="Личный текст ответа до повторной отправки сюда не попадает" />
        <div className="fp-stack">{m.messages.map((message) => <div className="fp-formal-question" key={message.id}><div><strong>{message.kind === 'question' ? 'Вопрос' : 'Ответ'} · {message.author_name}</strong><small>{timeText(message.created_at)}{message.version_number && ` · версия ${message.version_number}`}</small><p>{message.text}</p></div></div>)}</div>
      </Panel>
    </div><div className="fp-stack"><Panel className="fp-version-card"><PanelTitle title="Версии не перезаписываются" />
      {m.versions.map((version) => <div className="fp-version-line" key={version.version}><span>{version.version}</span><div><strong>Представленная версия {version.version}</strong><small>Исходные записи и документы сохранены</small></div><LockKeyhole size={18} /></div>)}
      {!m.reviewerClosed && <p>{m.role === 'reviewer' ? 'Новый черновик недоступен до повторной отправки.' : `Ответ и правки версии ${m.workingVersion} остаются личными до отправки.`}</p>}
    </Panel><Notice icon={<LockKeyhole size={19} />}>После исправлений кандидат в резерв снова проверяет комплектность и отправляет новую зафиксированную версию.</Notice>
      <Panel><PanelTitle title="Это рабочее уточнение" /><p>Кадровый специалист может связаться с кандидатом лично по телефону и почте. Технические вопросы — операторам по контактам внизу платформы.</p></Panel></div></div>
  </>
}

export function ResultScreen(m: ProfileModel) {
  return <>
    <div className="fp-material-strip"><div><span className="fp-avatar">К</span><div><strong>{m.visibleCandidate.fullName}</strong><small>{m.profileId} · представленная версия {m.presented?.version}</small></div></div>
      <button className="fp-button fp-button-outline" onClick={m.exportSummary}><Download size={16} />Выгрузить учебный результат</button></div>
    {m.reviewerClosed ? <>
      <Panel className="fp-result-banner"><span><BadgeCheck size={36} /></span><div><Badge tone="teal">Статус зафиксирован</Badge><h2>{m.profileStatus}</h2><p>Статус отображается кандидату в резерв. Это результат рассмотрения сведений, не решение о назначении.</p></div><div><small>Уполномоченный специалист</small><strong>{m.decisionAuthor}</strong></div></Panel>
      <div className="fp-columns fp-form-columns"><Panel><PanelTitle title="Основание и комментарий" /><div className="fp-result-basis"><FileCheck2 size={26} /><div><strong>{m.decisionBasis}</strong><small>Подтверждающее основание внесено человеком</small></div></div><p className="fp-reply-text">{m.decisionComment}</p>
        {m.decisionDocument && <FileRow name={m.decisionFile} url={m.decisionDocument.url} note="Подтверждающий документ результата" onPreview={m.showDocument} onDownload={m.recordDownload} />}</Panel>
        <div className="fp-stack"><Panel><PanelTitle title="Сохранённая история" />{m.versions.map((version) => <div className="fp-version-line" key={version.version}><span>{version.version}</span><div><strong>Версия {version.version}</strong><small>{version.createdAt} · {version.documentCount} документов</small></div><LockKeyhole size={18} /></div>)}
          <button className="fp-text-button" onClick={() => m.navigate('history')}>Открыть журнал<ArrowRight size={15} /></button></Panel><Notice tone="neutral">Юридически значимое решение о назначении принимается вне платформы.</Notice></div></div>
    </> : <div className="fp-columns fp-form-columns"><Panel><PanelTitle title="Рассмотрение представленной версии" subtitle="Выберите рабочий или итоговый статус; автоматического кадрового решения нет" />
      <Field label="Итоговый статус профиля" value={m.decisionStatus} options={['Принят к рассмотрению', 'Требуются уточнения', 'Снят с рассмотрения обоснованием', 'Рассмотрение завершено']} onChange={m.setDecisionStatus} required />
      {m.finalDecision && <><div className="fp-result-checks">{['Получатели и основания выплат сопоставлены', 'Вопрос о повторном учёте рассмотрен', 'Деятельность, периоды и документы проверены'].map((text, index) => <label className="fp-checkbox" key={text}><input type="checkbox" checked={m.reviewChecks[index]} onChange={(e) => m.setReviewChecks((previous) => previous.map((value, i) => i === index ? e.target.checked : value))} /><span>{text}</span></label>)}</div>
        <Field label="Реквизиты подтверждающего основания" value={m.decisionBasis} onChange={m.setDecisionBasis} required hint="Реквизиты согласованного результата предварительного рассмотрения" /></>}
      <label className="fp-field"><span className="fp-field-label">Комментарий к результату<em aria-hidden="true"> *</em></span><textarea aria-label="Комментарий к результату" maxLength={4000} rows={4} value={m.decisionComment} onChange={(e) => m.setDecisionComment(e.target.value)} placeholder="Что сопоставлено, что нужно уточнить и на каком основании выбран статус…" /></label>
      {m.finalDecision && <>{m.decisionDocument && <FileRow name={m.decisionFile} url={m.decisionDocument.url} onPreview={m.showDocument} onDownload={m.recordDownload} />}<UploadBox label="Подтверждающий документ результата" onUpload={m.reviewReadOnly ? undefined : m.attachDecision} /></>}
      {m.finalDecision && (m.unassessedDocuments > 0 || m.unresolvedSignals > 0 || m.phase === 'clarification') && <Notice tone="amber">
        Для закрытия сначала завершите работу с текущей версией: документов без пригодной ручной оценки — {m.unassessedDocuments}; неразрешённых сигналов — {m.unresolvedSignals}.
        {m.phase === 'clarification' && ' Ожидается повторное представление кандидатом в резерв.'}
        <br /><button className="fp-text-button" onClick={() => m.navigate('documents')}>Оценить документы</button><button className="fp-text-button" onClick={() => m.navigate('signals')}>Рассмотреть сигналы</button>
      </Notice>}
      <button className="fp-button fp-full" disabled={!m.canDecide} onClick={m.complete}><BadgeCheck size={17} />{m.finalDecision ? 'Зафиксировать итоговый статус' : 'Зафиксировать статус'}</button>
    </Panel><div className="fp-stack"><Panel className="fp-privacy-card"><ShieldCheck size={28} /><h2>Решение принимает человек</h2><p>Для завершения или снятия обязательны реквизиты, документ-основание и комментарий. Статус виден кандидату в резерв.</p></Panel>
      <Panel><PanelTitle title="Рабочие состояния материала" /><ul className="fp-status-list"><li><Badge tone="blue">Принят к рассмотрению</Badge></li><li><Badge tone="amber">Требуются уточнения</Badge></li><li><Badge tone="neutral">Снят с рассмотрения обоснованием</Badge></li><li><Badge tone="teal">Рассмотрение завершено</Badge></li></ul></Panel>
      <Notice tone="neutral">Все действия фиксируются в журнале учебного сценария. После закрытия анкеты её рассмотрение в платформе заканчивается.</Notice></div></div>}
  </>
}

export function HistoryScreen(m: ProfileModel) {
  const events = m.audit.filter((event) => m.role === 'reservist' || event.scope === 'submitted').slice().reverse()
  return <>
    <div className="fp-history-versions">{m.versions.map((version) => <Panel key={version.version}><PanelTitle title={`Представленная версия ${version.version}`} action={<Badge tone="blue">Зафиксирована</Badge>} />
      <div className="fp-key-row"><span>Отправлено</span><strong>{version.createdAt}</strong></div><div className="fp-key-row"><span>Документов</span><strong>{version.documentCount}</strong></div><small><LockKeyhole size={13} />Исходные сведения не изменены</small>
      <button className="fp-text-button" onClick={() => m.printSubmittedVersion(version.version)}>Печать этой версии<ArrowRight size={14} /></button>
      {m.role === 'reviewer' && <button className="fp-text-button" onClick={() => { m.chooseSignalVersion(version.version); m.navigate('signals') }}>Сигналы этой версии</button>}
      <details className="fp-version-files"><summary>Оригиналы файлов этой версии ({version.documentCount})</summary><div className="fp-stack">{version.attachments.map((file) => <FileRow key={file.id} name={file.name} url={file.url} note={file.section} onPreview={m.showDocument} onDownload={m.recordDownload} />)}</div></details>
    </Panel>)}
      {m.versions.length === 1 && <Panel><PanelTitle title="Новая версия ещё не представлена" action={<Badge tone="neutral">Ожидание</Badge>} /><p>Личный черновик и самопроверка кандидата в резерв недоступны проверяющему.</p></Panel>}
    </div>
    {m.versions.length > 1 && <Panel><PanelTitle title="Изменения между последними версиями" action={<button className="fp-text-button" onClick={m.loadDiff}>Сравнить версии</button>} />
      {m.versionDiff && <><p>Версия {m.versionDiff.version_from} → {m.versionDiff.version_to}: {m.versionDiff.changed} изменений.</p><div className="fp-table-scroll"><table className="fp-table"><thead><tr><th>Поле</th><th>Было</th><th>Стало</th></tr></thead><tbody>
        {m.versionDiff.entries.map((entry, index) => <tr key={index}><td>{entry.path}</td><td>{typeof entry.before === 'object' ? JSON.stringify(entry.before) : String(entry.before ?? '—')}</td><td>{typeof entry.after === 'object' ? JSON.stringify(entry.after) : String(entry.after ?? '—')}</td></tr>)}
      </tbody></table></div></>}
    </Panel>}
    <Panel><PanelTitle title="Журнал представленного материала" subtitle="Вход, просмотр, загрузка, выгрузка, комментарий и изменение статуса" />
      <div className="fp-table-scroll"><table className="fp-table fp-audit-table"><thead><tr><th>Дата и время</th><th>Пользователь</th><th>Действие</th><th>Доступ</th></tr></thead><tbody>
        {events.map((event, index) => <tr key={index}><td>{event.time}</td><td>{event.actor}</td><td>{event.action}</td><td><Badge tone="neutral">{event.scope === 'private' ? 'Личный черновик' : 'Представленный материал'}</Badge></td></tr>)}
      </tbody></table></div>
    </Panel><Notice icon={<LockKeyhole size={19} />}>Проверяющему доступны только события представленного материала. Содержание черновика и подсказки самопроверки не передаются.</Notice>
  </>
}

export function InstructionsScreen(m: ProfileModel) {
  return <div className="fp-columns fp-form-columns"><div className="fp-stack"><Panel><PanelTitle title="Этапы заполнения" /><ol className="fp-instruction-stages">{profileStages.map(([value, title]) => <li key={value}><strong>{value}%</strong><span>{title}</span></li>)}</ol><p className="fp-instruction-note">Проценты обозначают этапы подготовки сведений, а не оценку денежных поступлений. На этапе отправки также нужен подписанный скан согласия.</p></Panel>
    <Panel><PanelTitle title="Документы и исключения" /><div className="fp-document-exception"><FileCheck2 size={19} /><div><strong>Документ-основание</strong><small>НПА, приказ, решение органа, договор или справка. Для полученной поддержки и планируемого жилья — обязательно.</small></div></div>
      <div className="fp-document-exception"><CheckCircle2 size={19} /><div><strong>Пенсии и социальные выплаты</strong><small>Только «Да / Нет». Документ не запрашивается.</small></div></div>
      <div className="fp-document-exception"><FileText size={19} /><div><strong>Единовременная выплата</strong><small>Документ при наличии; отсутствие файла само по себе не блокирует отправку.</small></div></div>
      <div className="fp-document-exception"><ShieldCheck size={19} /><div><strong>Согласие на обработку персональных данных</strong><small>Подписанный скан обязателен. Подтверждение передачи версии галочкой его не заменяет.</small></div></div>
      <p className="fp-instruction-note">Банковские выписки и справки по счетам не прикрепляются. Поздняя дата перечисления сама по себе не является противоречием периоду службы.</p>
    </Panel>
    <Panel><PanelTitle title="Раздельный учёт сведений" /><div className="fp-separation-row"><UsersRound size={19} /><div><strong>Выплаты членам семьи</strong><small>Получатель, ФИО, год рождения и связь с кандидатом. Не личные поступления кандидата в резерв.</small></div></div>
      <div className="fp-separation-row"><Link2 size={19} /><div><strong>Выплаты кандидату в резерв за родственника</strong><small>Сохраняется связь с основанием. Для родственника — только ФИО, степень родства и статус.</small></div></div>
      <div className="fp-separation-row"><Home size={19} /><div><strong>Планируемые и неденежные меры</strong><small>Планируемое жильё и натуральная помощь не суммируются с денежными поступлениями.</small></div></div>
    </Panel>
    <Panel><PanelTitle title="Единая печатная анкета" /><p>Кнопка «Печать» собирает введённые поля всех вкладок в один документ. Можно распечатать его или выбрать «Сохранить как PDF» в окне браузера.</p>
      <p className="fp-instruction-note">Кандидат в резерв может печатать неполный черновик; незаполненные обязательные поля отмечены. Проверяющий печатает только отправленную версию. Печать не отправляет сведения.</p>
      <button className="fp-text-button" disabled={m.role === 'reviewer' && !m.sent} onClick={() => m.navigate('print')}>Открыть печатную анкету<ArrowRight size={15} /></button>
    </Panel>
  </div><div className="fp-stack"><Panel className="fp-privacy-card"><LockKeyhole size={28} /><h2>Личный черновик доступен только кандидату в резерв</h2><p>Специалист получает доступ только к отправленной версии. Новые контакты, файлы и ответ до повторной отправки ему недоступны.</p><div className="fp-privacy-line"><History size={18} />Новая версия не переписывает исходные сведения и комментарии</div></Panel>
    <Panel><PanelTitle title="Что считается качеством документа" /><p>Автоматически проверяются пустой файл, размер до 5 МБ, разрешённый формат и сигнатура контейнера. Это не полная проверка целостности.</p>
      <p className="fp-instruction-note">Полнота страниц, читаемость, подпись и применимость основания — оценка кадрового специалиста с комментарием. Нет OCR, распознавания подписи и юридического вывода ИИ.</p></Panel>
    <Panel><PanelTitle title="Шаблоны и памятки" /><p>Доступны пустая анкета, универсальный лист описания выплаты и чек-лист скана. Это учебные заготовки, а не единый каталог региональных НПА или официальных выплат.</p>
      <button className="fp-text-button" onClick={() => m.navigate('templates')}>Открыть библиотеку<ArrowRight size={15} /></button></Panel>
    <Panel><PanelTitle title="Источники и ограничения" /><Notice tone="neutral"><strong>Сведения не получены</strong><br />Отсутствие ответа источника не означает отсутствия дохода.</Notice><p className="fp-instruction-note">Ведомственные источники и поиск банковских счетов не подключены. Решение о назначении принимается вне платформы.</p></Panel>
    <Panel><PanelTitle title="Серверный учебный контур" /><p>Все демонстрационные лица и документы вымышлены. Анкета, файлы, представленные версии, оценки и журнал сохраняются через API. После входа загружаются данные текущего аккаунта; сценарий Ковалёва не подставляется автоматически.</p><p className="fp-instruction-note">Статусы меняются только после ответа сервера. Черновик сохраняется автоматически и кнопкой «Сохранить сейчас». Для реальных данных нужны HTTPS, утверждённое согласие оператора и отключённый демодоступ. Пустые шаблоны не создают материал в очереди.</p></Panel>
  </div></div>
}
