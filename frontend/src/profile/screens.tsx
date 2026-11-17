import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Download,
  FileCheck2,
  FileText,
  GraduationCap,
  History,
  Home,
  Inbox,
  Info,
  Landmark,
  Link2,
  LockKeyhole,
  MessageSquareText,
  Plus,
  RotateCw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  WalletCards,
  AlertCircle
} from 'lucide-react'
import type { ReactNode } from 'react'
import type { ProfileModel } from './model'
import type { Screen } from './types'
import { person, profileId, profileStages, categoryDefinitions, documents, signalDefinitions } from './data'
import { Badge, Panel, PanelTitle, Notice, Field, Choice, FileRow, UploadBox, PersonHeader } from './ui'

export function HomeScreen(m: ProfileModel) {
  const {
    phase,
    candidate,
    presented,
    corrected,
    reply,
    decisionComment,
    decisionBasis,
    decisionFile,
    audit,
    completeness,
    ready,
    sent,
    version,
    progress,
    documentCount,
    profileStatus,
    navigate,
    showDocument
  } = m
  if (phase === 'completed' || phase === 'removed')
    return (
      <>
        <PersonHeader
          status={profileStatus}
          tone={phase === 'completed' ? 'teal' : 'neutral'}
          version={`представленная версия ${presented?.version}`}
          details={presented?.candidate || candidate}
        >
          <div className="fp-person-next">
            <span className="fp-eyebrow">СПЕЦИАЛИСТ</span>
            <strong>
              Анна Иванова
              <br />
              08.11.2026 · 10:42
            </strong>
            <Badge tone="teal">
              <FileCheck2 size={13} />
              Основание внесено
            </Badge>
          </div>
        </PersonHeader>
        <Notice tone="teal" icon={<BadgeCheck size={21} />}>
          <strong>Результат рассмотрения доступен вам.</strong> Он относится к представленным сведениям, а не
          к назначению на должность.
        </Notice>
        <div className="fp-columns fp-form-columns">
          <Panel>
            <PanelTitle
              title="Основание результата"
              subtitle="Зафиксировано уполномоченным кадровым специалистом"
            />
            <div className="fp-result-basis">
              <FileCheck2 size={26} />
              <div>
                <strong>{decisionBasis}</strong>
                <small>Версия {presented?.version} · подтверждающее основание</small>
              </div>
            </div>
            <p className="fp-reply-text">{decisionComment}</p>
            <FileRow
              name={decisionFile}
              note="Учебный документ результата рассмотрения"
              onPreview={showDocument}
            />
            <div className="fp-divider" />
            <div className="fp-resolved-row">
              <CheckCircle2 size={18} />
              <span>Выплата за родственника уточнена</span>
              <Badge tone="teal">Рассмотрено</Badge>
            </div>
            <div className="fp-resolved-row">
              <CheckCircle2 size={18} />
              <span>Вопрос о повторном учёте рассмотрен</span>
              <Badge tone="teal">Рассмотрено</Badge>
            </div>
            <div className="fp-resolved-row">
              <CheckCircle2 size={18} />
              <span>Договор и период деятельности сопоставлены</span>
              <Badge tone="teal">Рассмотрено</Badge>
            </div>
          </Panel>
          <div className="fp-stack">
            <Panel>
              <PanelTitle title="Ваши представленные версии" />
              <div className="fp-version-line">
                <span>1</span>
                <div>
                  <strong>Исходный материал</strong>
                  <small>Записи, документы и вопросы сохранены</small>
                </div>
                <LockKeyhole size={18} />
              </div>
              <div className="fp-version-line">
                <span>2</span>
                <div>
                  <strong>Уточнённые сведения</strong>
                  <small>Рассмотрены с подтверждающим основанием</small>
                </div>
                <CheckCircle2 size={18} />
              </div>
              <button className="fp-text-button" onClick={() => navigate('messages')}>
                Посмотреть уточнения
                <ArrowRight size={15} />
              </button>
            </Panel>
            <Panel className="fp-privacy-card">
              <ShieldCheck size={28} />
              <h2>Решение о назначении — вне платформы</h2>
              <p>
                Профиль помогает подготовить и уточнить сведения. Завершение их рассмотрения не является
                автоматическим допуском или отказом в назначении.
              </p>
            </Panel>
          </div>
        </div>
      </>
    )
  return (
    <>
      <PersonHeader
        status={profileStatus}
        tone={sent ? (phase === 'clarification' ? 'amber' : 'teal') : 'blue'}
        version={sent ? `представленная версия ${presented?.version}` : 'версия 1'}
        details={candidate}
        progress={!sent ? progress : undefined}
      >
        <button className="fp-button" onClick={() => navigate(sent ? 'messages' : 'selfcheck')}>
          {sent ? 'Уточнения и статус' : 'Самопроверка'}
          <ArrowRight size={16} />
        </button>
      </PersonHeader>
      <div className="fp-columns fp-home-columns">
        <Panel>
          <PanelTitle
            title="Разделы профиля"
            action={<Badge tone="neutral">{documentCount} документов</Badge>}
          />
          <div className="fp-section-list">
            {[
              [
                'Личные сведения и программа',
                'Контакты, поток, диплом и акт о включении в резерв',
                'profile',
                true,
                <UserRound size={20} />
              ],
              [
                'Служба, родство и получатели',
                'Периоды службы и минимальные сведения о родственниках',
                'kinship',
                true,
                <UsersRound size={20} />
              ],
              [
                'Выплаты и меры поддержки',
                `Все ответы даны · ${corrected ? 7 : 8} записей, включая планируемую меру`,
                'payments',
                ready,
                <WalletCards size={20} />
              ],
              [
                'Экспертная и преподавательская работа',
                'Организация, договор и период деятельности',
                'activities',
                true,
                <GraduationCap size={20} />
              ]
            ].map(([title, note, target, done, icon]) => (
              <button
                className={`fp-section-row ${done ? 'done' : 'pending'}`}
                key={String(title)}
                onClick={() => navigate(target as Screen)}
              >
                <span className="fp-section-icon">{done ? <Check size={20} /> : (icon as ReactNode)}</span>
                <div>
                  <strong>{String(title)}</strong>
                  <small>{String(note)}</small>
                </div>
                {done ? (
                  <Badge tone="teal">Заполнено</Badge>
                ) : (
                  <Badge tone="amber">{completeness.missing} к уточнению</Badge>
                )}
              </button>
            ))}
          </div>
        </Panel>
        <div className="fp-stack">
          <Panel className="fp-recent-card">
            <PanelTitle title="Последние действия" action={<History size={19} />} />
            <div className="fp-recent-actions">
              {audit
                .filter((event) => event.actor === 'Резервист')
                .slice(-3)
                .reverse()
                .map((event, index) => (
                  <div key={`${event.action}-${index}`}>
                    <span />
                    <div>
                      <small>{event.time}</small>
                      <strong>{event.action}</strong>
                    </div>
                  </div>
                ))}
            </div>
          </Panel>
          <Notice tone="neutral" icon={<LockKeyhole size={20} />}>
            <strong>
              {sent
                ? 'Зафиксирована только отправленная версия.'
                : 'Личный черновик доступен только резервисту.'}
            </strong>
            <br />
            Изменения, подсказки и история черновика не передаются проверяющему.
            <br />
            <button className="fp-text-button" onClick={() => navigate('instructions')}>
              Правила передачи сведений
              <ArrowRight size={14} />
            </button>
          </Notice>
        </div>
      </div>
    </>
  )
}

export function ProfileScreen(m: ProfileModel) {
  const {
    candidate,
    setToast,
    navigate,
    showDocument,
    updateCandidate,
    servicePeriods,
    addServicePeriod,
    updateServicePeriod,
    removeServicePeriod
  } = m
  return (
    <div className="fp-columns fp-form-columns">
      <div className="fp-stack">
        <Panel>
          <PanelTitle
            eyebrow="ЭТАП 10%"
            title="Личные сведения и контакты"
            action={
              <Badge tone="teal">
                <Check size={13} />
                Указаны пользователем
              </Badge>
            }
          />
          <div className="fp-fields">
            <Field label="Фамилия, имя, отчество" value={person} required wide />
            <Field
              label="Год рождения"
              value={candidate.birthYear}
              onChange={(value) => updateCandidate('birthYear', value)}
              required
            />
            <Field label="Текущее место работы" value="Учебный центр «Регион»" required />
            <Field
              label="Мобильный телефон"
              type="tel"
              value={candidate.phone}
              onChange={(value) => updateCandidate('phone', value)}
            />
            <Field
              label="Электронная почта"
              type="email"
              value={candidate.email}
              onChange={(value) => updateCandidate('email', value)}
            />
            <Field
              label="Текущий статус работы"
              value="Находится в запасе"
              options={[
                'Проходит службу',
                'Работает вне государственной службы',
                'Находится в запасе',
                'Находится в отставке'
              ]}
              required
              wide
            />
            <Field
              label="Предполагаемый орган назначения"
              value={candidate.appointmentAuthority}
              options={[
                'Не указан',
                'ОИВ субъекта Российской Федерации',
                'Федеральный орган исполнительной власти'
              ]}
              onChange={(value) => updateCandidate('appointmentAuthority', value)}
              optional
              wide
            />
          </div>
        </Panel>
        <Panel>
          <PanelTitle eyebrow="ЭТАП 30%" title="Программа и включение в резерв" />
          <div className="fp-fields">
            <Field
              label="Поток программы «Время героев»"
              value={candidate.flow}
              onChange={(value) => updateCandidate('flow', value)}
              required
            />
            <Field
              label="Год обучения"
              value={candidate.programYear}
              onChange={(value) => updateCandidate('programYear', value)}
              required
            />
            <Field
              label="Регион"
              value={candidate.region}
              onChange={(value) => updateCandidate('region', value)}
              required
              wide
            />
            <Field
              label="Наименование региональной программы"
              value={candidate.regionalProgram}
              onChange={(value) => updateCandidate('regionalProgram', value)}
              optional
              wide
            />
            <Field
              label="Год региональной программы"
              value={candidate.regionalProgramYear}
              onChange={(value) => updateCandidate('regionalProgramYear', value)}
              optional
            />
            <Field label="Организатор программы" value="Учебный центр «Резерв»" required />
            <Field label="Реквизиты диплома" value="ДП-2024-0147 от 20.12.2024" required />
            <Field label="Номер и дата акта о включении в резерв" value="№ 147-Р от 14.09.2025" required />
          </div>
          <FileRow
            name="Диплом_переподготовка.pdf"
            note="Диплом о профессиональной переподготовке · демо"
            onPreview={showDocument}
          />
        </Panel>
        <Panel>
          <PanelTitle
            eyebrow="ЭТАП 50%"
            title="Периоды воинской и государственной службы"
            action={
              <button
                className="fp-button fp-button-outline"
                onClick={addServicePeriod}
              >
                <Plus size={15} />
                Добавить период
              </button>
            }
          />
          <div className="fp-service">
            <span className="fp-section-icon">
              <ShieldCheck size={21} />
            </span>
            <div>
              <strong>Военная служба</strong>
              <small>Старший офицерский состав</small>
            </div>
            <div>
              <small>Начало — окончание</small>
              <strong>01.06.2023 — 31.08.2025</strong>
            </div>
            <Badge tone="teal">Заполнено</Badge>
          </div>
          <div className="fp-service">
            <span className="fp-section-icon fp-blue">
              <Building2 size={21} />
            </span>
            <div>
              <strong>Иное место работы</strong>
              <small>Учебный центр «Регион»</small>
            </div>
            <div>
              <small>Начало — окончание</small>
              <strong>01.09.2025 — настоящее время</strong>
            </div>
            <Badge tone="teal">Заполнено</Badge>
          </div>
          {servicePeriods.map((period) => (
            <div className="fp-crud-row" key={period.id}>
              <Field
                label="Вид службы"
                value={period.kind}
                onChange={(value) => updateServicePeriod(period.id, 'kind', value)}
                wide
              />
              <Field
                label="Начало"
                type="date"
                value={period.start}
                onChange={(value) => updateServicePeriod(period.id, 'start', value)}
              />
              <Field
                label="Окончание"
                type="date"
                value={period.end}
                onChange={(value) => updateServicePeriod(period.id, 'end', value)}
              />
              <button
                className="fp-icon-button"
                aria-label="Удалить период"
                onClick={() => removeServicePeriod(period.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <small className="fp-footnote">
            Виды службы: военная, государственная, иное. Категории: младший, старший, высший офицерский состав
            или волонтёр.
          </small>
        </Panel>
      </div>
      <div className="fp-stack">
        <Panel className="fp-mini-person">
          <div className="fp-avatar fp-avatar-photo">
            <UserRound size={33} />
          </div>
          <h2>Фото для карточки</h2>
          <p>Необязательное поле</p>
          <label className="fp-button fp-button-outline fp-photo-upload">
            <Upload size={15} />
            Загрузить фото
            <input
              aria-label="Фото для карточки"
              type="file"
              accept="image/*"
              onChange={() => setToast('Фото выбрано только в демонстрационном макете')}
            />
          </label>
          <small>
            Только для визуального удобства.
            <br />
            Распознавание лиц не используется.
          </small>
        </Panel>
        <Notice tone="neutral" icon={<LockKeyhole size={19} />}>
          Изменения контактов и программы останутся в личном черновике до отправки новой версии.
        </Notice>
        <button className="fp-button fp-full" onClick={() => navigate('kinship')}>
          Родство и получатели
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

export function KinshipScreen(m: ProfileModel) {
  const {
    relativeAnswer,
    setRelativeAnswer,
    question,
    navigate,
    showDocument,
    familyRecipients,
    addRecipient,
    updateRecipient,
    removeRecipient
  } = m
  return (
    <div className="fp-columns fp-form-columns">
      <div className="fp-stack">
        <Panel>
          <PanelTitle
            eyebrow="ЭТАП 50%"
            title="Родство с участником СВО"
            action={<Badge tone="teal">Ответ дан</Badge>}
          />
          <div className="fp-question">
            <strong>Являетесь ли вы родственником участника СВО?</strong>
            <Choice value={relativeAnswer} onChange={setRelativeAnswer} />
          </div>
          {relativeAnswer === 'Да' ? (
            <>
              <div className="fp-fields">
                <Field label="ФИО родственника" value="Ковалёв Сергей Петрович" required wide />
                <Field
                  label="Степень родства"
                  value="Родитель"
                  options={['Супруг', 'Ребёнок', 'Родитель', 'Иная степень родства']}
                  required
                />
                <Field
                  label="Статус родственника"
                  value="Участвовал"
                  options={['Участвует', 'Участвовал', 'Погиб', 'Пропал без вести']}
                  required
                />
              </div>
              <div className="fp-question fp-question-bordered">
                <div>
                  <strong>Получали ли вы выплаты в связи с этим родством?</strong>
                  <small>Получатель — вы; основание связано с родственником</small>
                </div>
                <Choice value="Да" />
              </div>
              <button className="fp-linked-record" onClick={() => navigate('insurance')}>
                <span>
                  <Link2 size={19} />
                </span>
                <div>
                  <strong>Выплата за родственника · 320 000 ₽</strong>
                  <small>Алексей Ковалёв → родитель → решение органа № К-24</small>
                </div>
                <ChevronRight size={19} />
              </button>
            </>
          ) : (
            <Notice tone="teal">
              Дополнительные поля родства закрыты. Данные родственника не запрашиваются.
            </Notice>
          )}
        </Panel>
        <Panel>
          <PanelTitle
            title="Выплата члену семьи за резервиста"
            subtitle="Отдельный блок: получатель не сам резервист"
            action={<Badge tone="blue">1 получатель</Badge>}
          />
          <div className="fp-fields">
            <Field label="ФИО получателя" value="Ковалёва Мария Андреевна" required wide />
            <Field label="Связь с кандидатом" value="Супруга" required />
            <Field label="Год рождения получателя" value="1989" required />
          </div>
          <FileRow
            name="Решение_члену_семьи.pdf"
            note="Решение органа назначения · 120 000 ₽ · демо"
            required
            onPreview={showDocument}
          />
          {familyRecipients.map((recipient) => (
            <div className="fp-crud-row" key={recipient.id}>
              <Field
                label="ФИО получателя"
                value={recipient.fullName}
                onChange={(value) => updateRecipient(recipient.id, 'fullName', value)}
                wide
              />
              <Field
                label="Связь с кандидатом"
                value={recipient.relation}
                onChange={(value) => updateRecipient(recipient.id, 'relation', value)}
              />
              <Field
                label="Год рождения"
                value={recipient.year}
                onChange={(value) => updateRecipient(recipient.id, 'year', value)}
              />
              <button
                className="fp-icon-button"
                aria-label="Удалить получателя"
                onClick={() => removeRecipient(recipient.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button className="fp-text-button" onClick={addRecipient}>
            <Plus size={15} />
            Добавить сведения о другом получателе
          </button>
        </Panel>
      </div>
      <div className="fp-stack">
        <Panel className="fp-privacy-card">
          <UsersRound size={28} />
          <h2>Минимум данных о родственнике</h2>
          <p>Для участника СВО — только ФИО, степень родства и предусмотренный анкетой статус.</p>
          <ul>
            <li>Без подробностей службы</li>
            <li>Без медицинских сведений</li>
            <li>Без полного финансового профиля</li>
          </ul>
        </Panel>
        <Panel>
          <PanelTitle title="Не путайте получателей" />
          <div className="fp-recipient-example">
            <span className="fp-avatar">АК</span>
            <div>
              <strong>Резервист получил за родственника</strong>
              <small>Личная запись со связью с родственником</small>
            </div>
          </div>
          <div className="fp-recipient-example">
            <span className="fp-avatar fp-avatar-purple">МК</span>
            <div>
              <strong>Супруга получила за резервиста</strong>
              <small>Отдельная запись члена семьи</small>
            </div>
          </div>
          <Notice>
            Год рождения нужен в блоке получателя — члена семьи, но не добавляется в минимальную карточку
            участника СВО.
          </Notice>
        </Panel>
      </div>
    </div>
  )
}

export function PaymentsScreen(m: ProfileModel) {
  const {
    supportFile,
    housingYear,
    housingAnswer,
    setActiveCategory,
    categoryAnswers,
    corrected,
    completeness,
    navigate
  } = m
  return (
    <>
      <div className="fp-payments-summary">
        <div>
          <span className="fp-summary-symbol">
            <WalletCards size={26} />
          </span>
          <div>
            <span className="fp-eyebrow">ЭТАП 70% · ОТВЕТЫ ПО КАЖДОМУ БЛОКУ</span>
            <h2>10 из 10 ответов даны</h2>
            <p>Записи и обязательные вложения учитываются на этапе 90%</p>
          </div>
        </div>
        <div className="fp-summary-count">
          <strong>
            {10 - completeness.missing}
            <span> / 10</span>
          </strong>
          <small>блоков готовы</small>
        </div>
      </div>
      <Panel className="fp-category-panel">
        <div className="fp-category-head">
          <span>Категория и требования к вводу</span>
          <span>Ваш ответ</span>
          <span>Сведения</span>
          <span>Готовность</span>
        </div>
        {categoryDefinitions.map((category, index) => {
          const missing =
            (index === 3 && !supportFile) ||
            (index === 8 && housingAnswer !== 'Нет' && !/^20\d{2}$/.test(housingYear))
          const answer =
            index === 8
              ? housingAnswer
              : index === 2 && corrected
                ? 'Нет'
                : categoryAnswers[index] || category.answer
          return (
            <button
              key={category.title}
              className={`fp-category-row ${missing ? 'fp-category-missing' : ''}`}
              onClick={() => {
                if (category.target) navigate(category.target)
                else {
                  setActiveCategory(index)
                  navigate('category')
                }
              }}
            >
              <div className="fp-category-main">
                <span className="fp-category-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="fp-category-icon">{category.icon}</span>
                <div>
                  <strong>{category.title}</strong>
                  <small>{category.note}</small>
                </div>
              </div>
              <Badge tone={answer === 'Нет' ? 'neutral' : answer === 'Планируется' ? 'blue' : 'teal'}>
                {answer}
              </Badge>
              <span className="fp-category-records">
                {corrected && index === 2 ? 'Нет выплат' : category.records}
              </span>
              <span className={`fp-category-status ${missing ? 'missing' : ''}`}>
                {missing ? (
                  <>
                    <AlertCircle size={16} />
                    {index === 3 ? 'Нужен файл' : 'Укажите год'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Заполнено
                  </>
                )}
                <ChevronRight size={15} />
              </span>
            </button>
          )
        })}
      </Panel>
      <div className="fp-payments-bottom">
        <Notice>
          <strong>Не все «Да» требуют справку.</strong> Для пенсий и социальных выплат документ не
          запрашивается; для единовременной выплаты — при наличии.
        </Notice>
        <button className="fp-button" onClick={() => navigate('selfcheck')}>
          К самопроверке
          <ArrowRight size={16} />
        </button>
      </div>
    </>
  )
}

export function CategoryScreen(m: ProfileModel) {
  const {
    activeCategory,
    categoryAnswers,
    setCategoryAnswers,
    question,
    navigate,
    showDocument,
    records,
    addRecord,
    updateRecord,
    removeRecord,
    addAttachment
  } = m
  const category = categoryDefinitions[activeCategory]
  const answer = categoryAnswers[activeCategory] || category.answer
  const setAnswer = (value: string) =>
    setCategoryAnswers((previous) => ({ ...previous, [activeCategory]: value }))
  return (
    <>
      <button className="fp-back" onClick={() => navigate('payments')}>
        <ArrowLeft size={15} />К категориям выплат
      </button>
      <div className="fp-columns fp-form-columns">
        <div className="fp-stack">
          <Panel>
            <PanelTitle
              title={category.title}
              action={<Badge tone="blue">Блок {activeCategory + 1} / 10</Badge>}
            />
            <div className="fp-question">
              <strong>
                {activeCategory === 9
                  ? 'Предоставлялась ли неденежная мера поддержки?'
                  : 'Осуществлялась ли выплата или предоставлялась мера?'}
              </strong>
              <Choice value={answer} onChange={setAnswer} />
            </div>
            {activeCategory === 5 ? (
              <Notice tone="teal">
                <strong>Документированные сведения не требуются.</strong>
                <br />В этом блоке нужен только ответ «Да / Нет». Запроса справок из банков или социальных
                фондов в макете нет.
              </Notice>
            ) : answer === 'Нет' ? (
              <Notice tone="teal">Ответ дан. Дополнительные поля этой категории закрыты.</Notice>
            ) : (
              <>
                {(activeCategory === 0 || activeCategory === 1) && (
                  <>
                    <div className="fp-fields">
                      {activeCategory === 1 && (
                        <>
                          <Field
                            label="Вид надбавки"
                            value="Дополнительная выплата по назначению Н-42"
                            required
                            wide
                          />
                          <Field
                            label="Основание надбавки"
                            value="Учебный приказ о назначении · приложение № 2"
                            required
                            wide
                          />
                        </>
                      )}
                      <Field label="Начало периода" value="01.06.2023" required />
                      <Field label="Окончание периода" value="31.08.2025" required />
                      <Field label="Плательщик (часть, ведомство)" value="Учебное ведомство" required />
                      <Field label="Получатель" value="Алексей Ковалёв" required />
                    </div>
                    <FileRow
                      name="Приказ_назначение.pdf"
                      note="Приказ о назначении на должность · содержит финансовые условия"
                      required
                      onPreview={showDocument}
                    />
                    {activeCategory === 1 && (
                      <div className="fp-extra-upload">
                        <UploadBox
                          label="Дополнительное основание надбавки"
                          optional
                          onUpload={addAttachment}
                        />
                      </div>
                    )}
                  </>
                )}
                {activeCategory === 6 && (
                  <>
                    <div className="fp-fields">
                      <Field label="Связь с кандидатом" value="Супруга" required />
                      <Field label="Год рождения получателя" value="1989" required />
                      <Field
                        label="ФИО получателя — члена семьи"
                        value="Ковалёва Мария Андреевна"
                        required
                        wide
                      />
                      <Field label="Сумма, ₽" value="120 000" required />
                      <Field label="Основание получения" value="Выплата супруге за резервиста" required />
                    </div>
                    <FileRow
                      name="Решение_члену_семьи.pdf"
                      note="Решение органа назначения или иной правовой акт"
                      required
                      onPreview={showDocument}
                    />
                  </>
                )}
                {activeCategory === 7 && (
                  <>
                    <div className="fp-fields">
                      <Field
                        label="Назначение помощи"
                        value="Помощь для учебной и экспертной деятельности"
                        required
                        wide
                      />
                      <Field
                        label="Форма помощи"
                        value="Натуральная"
                        options={['Денежная', 'Натуральная']}
                        required
                      />
                      <Field label="Организация или фонд" value="Учебный фонд «Поддержка»" required />
                      <Field
                        label="Предоставленная мера"
                        value="Ноутбук для учебной деятельности"
                        required
                        wide
                      />
                    </div>
                    <FileRow
                      name="Письмо_фонда.pdf"
                      note="Решение, договор либо письмо о предоставлении помощи"
                      required
                      onPreview={showDocument}
                    />
                    <Notice tone="blue">
                      Натуральная форма хранится отдельно и не прибавляется к денежным поступлениям.
                    </Notice>
                  </>
                )}
                {activeCategory === 9 && (
                  <>
                    <div className="fp-fields">
                      <Field label="Описание меры" value="Неденежная поддержка или награда" wide />
                    </div>
                    <UploadBox
                      label="Документ неденежной меры"
                      onUpload={addAttachment}
                    />
                    <Notice>
                      Можно указать даже небольшую меру. Значимость документа оценивает проверяющий, а не
                      автоматический фильтр.
                    </Notice>
                  </>
                )}
              </>
            )}
            {answer !== 'Нет' && activeCategory !== 5 && (
              <div className="fp-crud-list">
                {(records[activeCategory] || []).map((record) => (
                  <div className="fp-crud-row" key={record.id}>
                    <Field
                      label="Наименование записи"
                      value={record.title}
                      onChange={(value) => updateRecord(activeCategory, record.id, 'title', value)}
                      wide
                    />
                    <Field
                      label="Сумма, ₽"
                      value={record.amount}
                      onChange={(value) => updateRecord(activeCategory, record.id, 'amount', value)}
                    />
                    <Field
                      label="Основание"
                      value={record.basis}
                      onChange={(value) => updateRecord(activeCategory, record.id, 'basis', value)}
                    />
                    <button
                      className="fp-icon-button"
                      aria-label="Удалить запись"
                      onClick={() => removeRecord(activeCategory, record.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                <button className="fp-text-button" onClick={() => addRecord(activeCategory)}>
                  <Plus size={15} />
                  Добавить запись
                </button>
              </div>
            )}
          </Panel>
          <button className="fp-button" onClick={() => navigate('payments')}>
            <Check size={16} />
            Сохранить и вернуться
          </button>
        </div>
        <div className="fp-stack">
          <Panel className="fp-explain-card">
            <span className="fp-explain-symbol">{category.icon}</span>
            <h2>
              {activeCategory === 6
                ? 'Это не личная выплата резервиста'
                : activeCategory === 5
                  ? 'Справка не запрашивается'
                  : activeCategory === 7 || activeCategory === 9
                    ? 'Денежное и неденежное — отдельно'
                    : 'Основание важнее банковской справки'}
            </h2>
            <p>
              {activeCategory === 6
                ? 'Получатель — член семьи. Указываются его связь с кандидатом, ФИО и год рождения. Такие записи не включаются в личные поступления резервиста.'
                : category.note}
            </p>
          </Panel>
          <Notice tone="neutral">
            Нет банковских выписок, автоматического поиска счетов и распознавания произвольных документов. Это
            демонстрационная форма на вымышленных данных.
          </Notice>
        </div>
      </div>
    </>
  )
}

export function PaymentScreen(m: ProfileModel) {
  const { navigate, showDocument } = m
  return (
    <>
      <button className="fp-back" onClick={() => navigate('payments')}>
        <ArrowLeft size={15} />К категориям выплат
      </button>
      <div className="fp-columns fp-form-columns">
        <div className="fp-stack">
          <Panel>
            <PanelTitle title="Событие и получатель" action={<Badge tone="blue">Запись ВП-003</Badge>} />
            <div className="fp-fields">
              <Field
                label="Наименование выплаты"
                value="Единовременная выплата по назначению Н-42"
                required
                wide
              />
              <Field label="Вид события" value="Завершение периода службы" required />
              <Field label="Дата события" value="31.08.2025" required />
              <Field
                label="Категория получателя"
                value="Сам резервист"
                options={['Сам резервист', 'Член семьи', 'Резервист за родственника']}
                required
              />
              <Field label="Получатель" value="Алексей Ковалёв" required />
              <Field label="Сумма, ₽" value="150 000" required />
              <Field label="Плательщик" value="Учебное ведомство" required />
            </div>
          </Panel>
          <Panel>
            <PanelTitle
              title="Основание и даты"
              subtitle="Период, к которому относится выплата, хранится отдельно от даты перечисления"
            />
            <div className="fp-fields">
              <Field
                label="Нормативное основание и редакция"
                value="Учебный акт № 42 · редакция от 01.06.2025"
                required
                wide
              />
              <Field label="Период основания: начало" value="01.06.2023" required />
              <Field label="Период основания: окончание" value="31.08.2025" required />
              <Field label="Дата фактического перечисления" value="18.09.2025" required />
              <Field
                label="Идентификатор назначения"
                value="Н-42"
                hint="Помогает сопоставлять записи и искать возможные дубли"
              />
            </div>
            <FileRow
              name="Приказ_единовременная.pdf"
              note="При наличии · отсутствие файла само по себе не блокирует отправку"
              onPreview={showDocument}
            />
          </Panel>
        </div>
        <div className="fp-stack">
          <Panel className="fp-explain-card">
            <span className="fp-explain-symbol">
              <CalendarDays size={25} />
            </span>
            <h2>Две разные даты</h2>
            <p>Деньги могут поступить после окончания службы, но относиться к периоду её прохождения.</p>
            <div className="fp-date-example">
              <span>Служба закончилась</span>
              <strong>31 августа 2025</strong>
              <i />
              <span>Выплата поступила</span>
              <strong>18 сентября 2025</strong>
            </div>
            <Notice tone="teal">
              Это не прямое противоречие. Сопоставляются период основания и документ, а не только день
              перечисления.
            </Notice>
          </Panel>
          <Notice tone="neutral">
            <strong>Документ — при наличии.</strong>
            <br />
            Для этой категории не вводится универсальное требование загрузить банковскую справку.
          </Notice>
          <button className="fp-button fp-full" onClick={() => navigate('payments')}>
            <Check size={16} />
            Сохранить и вернуться
          </button>
        </div>
      </div>
    </>
  )
}

export function SupportScreen(m: ProfileModel) {
  const { supportFile, navigate, showDocument, attachSupport } = m
  return (
    <>
      <button className="fp-back" onClick={() => navigate('payments')}>
        <ArrowLeft size={15} />К категориям выплат
      </button>
      <div className="fp-columns fp-form-columns">
        <div className="fp-stack">
          <Panel>
            <PanelTitle title="Ответы по уровням поддержки" />
            <div className="fp-level-row">
              <span>
                <Landmark size={18} />
                Федеральная поддержка
              </span>
              <Choice value="Нет" />
            </div>
            <div className="fp-level-row">
              <span>
                <Building2 size={18} />
                Региональная поддержка
              </span>
              <Choice value="Да" />
            </div>
            <div className="fp-level-row">
              <span>
                <Home size={18} />
                Муниципальная поддержка
              </span>
              <Choice value="Нет" />
            </div>
          </Panel>
          <Panel>
            <PanelTitle title="Полученная мера" action={<Badge tone="blue">Региональная</Badge>} />
            <div className="fp-fields">
              <Field
                label="Уровень поддержки"
                value="Региональный"
                options={['Федеральный', 'Региональный', 'Муниципальный']}
                required
              />
              <Field label="Регион / орган назначения" value="Учебный региональный орган" required />
              <Field label="Наименование меры" value="Региональная мера поддержки участника" required wide />
              <Field label="Код меры" value="РМ-17" optional />
              <Field label="Дата выплаты" value="11.04.2025" required />
              <Field label="Получатель" value="Алексей Ковалёв" required />
              <Field label="Сумма, ₽" value="120 000" required />
            </div>
            {supportFile ? (
              <FileRow name={supportFile} required onPreview={showDocument} />
            ) : (
              <UploadBox label="Документ для региональной поддержки" error onUpload={attachSupport} />
            )}
          </Panel>
        </div>
        <div className="fp-stack">
          <Notice tone="red">
            <strong>Для полученной меры документ обязателен.</strong>
            <br />
            Решение органа назначения, НПА или справка уполномоченного органа. Пока вложения нет, отправка
            профиля заблокирована.
          </Notice>
          <Panel>
            <PanelTitle title="Как заполнить источник" />
            <p>
              Указывайте орган назначения меры. Отсутствующий ответ внешнего источника не означает, что
              поддержки не было.
            </p>
            <Badge tone="neutral">Ведомственные источники не подключены</Badge>
          </Panel>
          <button className="fp-button fp-full" onClick={() => navigate('payments')}>
            <Check size={16} />
            Сохранить и вернуться
          </button>
        </div>
      </div>
    </>
  )
}

export function InsuranceScreen(m: ProfileModel) {
  const { corrected, question, navigate, showDocument } = m
  return (
    <>
      <button className="fp-back" onClick={() => navigate('payments')}>
        <ArrowLeft size={15} />К категориям выплат
      </button>
      <div className="fp-columns fp-form-columns">
        <div className="fp-stack">
          <Panel>
            <PanelTitle title="Личные страховые выплаты и компенсации" />
            <div className="fp-question">
              <strong>Получали ли вы выплату в связи с личным участием?</strong>
              <Choice value="Нет" />
            </div>
            <Notice tone="neutral">Дополнительные поля личной выплаты закрыты.</Notice>
          </Panel>
          <Panel>
            <PanelTitle
              title="Выплаты за родственника — участника СВО"
              action={
                <Badge tone="blue">
                  <Link2 size={13} />
                  Связанные сведения
                </Badge>
              }
            />
            <div className="fp-question">
              <strong>Получали ли вы выплату за родственника?</strong>
              <Choice value="Да" />
            </div>
            <div className="fp-recipient-chain">
              <div>
                <span>ПОЛУЧАТЕЛЬ</span>
                <strong>Алексей Ковалёв</strong>
                <small>Сам резервист</small>
              </div>
              <ArrowRight size={19} />
              <div>
                <span>СВЯЗЬ</span>
                <strong>Сергей Ковалёв</strong>
                <small>Родитель · участвовал</small>
              </div>
              <ArrowRight size={19} />
              <div>
                <span>ОСНОВАНИЕ</span>
                <strong>Решение № К-24</strong>
                <small>24 апреля 2025</small>
              </div>
            </div>
            <div className="fp-fields">
              <Field label="Наименование выплаты" value="Компенсация по решению органа" required wide />
              <Field
                label="Основание в представленной записи"
                value={corrected ? 'В связи с родственником' : 'За личное участие'}
                options={['За личное участие', 'В связи с родственником']}
                required
              />
              <Field label="Дата фактического перечисления" value="30.04.2025" required />
              <Field label="Период основания" value="01.04.2025 — 30.04.2025" required />
              <Field label="Сумма, ₽" value="320 000" required />
            </div>
            <FileRow
              name="Решение_компенсация.pdf"
              note="Решение страховщика или уполномоченного органа · демо"
              required
              onPreview={showDocument}
            />
          </Panel>
        </div>
        <div className="fp-stack">
          <Panel className="fp-explain-card">
            <span className="fp-explain-symbol">
              <Link2 size={25} />
            </span>
            <h2>Получатель ≠ основание</h2>
            <p>
              Выплату получил резервист, но право на неё связано с родственником. Это отдельная связь в
              записи.
            </p>
            <ul className="fp-check-points">
              <li>
                <Check size={16} />
                Не смешивать с личными выплатами
              </li>
              <li>
                <Check size={16} />
                Не создавать профиль родственника
              </li>
              <li>
                <Check size={16} />
                Прикрепить решение или справку органа
              </li>
            </ul>
          </Panel>
          <Notice tone="amber">
            Сверьте выбранное основание с документом. Несовпадение — вопрос для уточнения, не автоматический
            отказ в назначении.
          </Notice>
          <button className="fp-button fp-full" onClick={() => navigate('payments')}>
            <Check size={16} />
            Сохранить и вернуться
          </button>
        </div>
      </div>
    </>
  )
}

export function HousingScreen(m: ProfileModel) {
  const {
    housingYear,
    setHousingYear,
    housingAnswer,
    setHousingAnswer,
    question,
    log,
    navigate,
    showDocument
  } = m
  return (
    <>
      <button className="fp-back" onClick={() => navigate('payments')}>
        <ArrowLeft size={15} />К категориям выплат
      </button>
      <div className="fp-columns fp-form-columns">
        <div className="fp-stack">
          <Panel>
            <PanelTitle title="Состояние жилищной меры" />
            <div className="fp-question">
              <strong>Предоставлялась ли вам жилищная мера?</strong>
              <Choice value={housingAnswer} onChange={setHousingAnswer} planned />
            </div>
            {housingAnswer === 'Нет' ? (
              <Notice tone="teal">Дополнительные поля закрыты. Ответ по категории дан.</Notice>
            ) : housingAnswer === 'Планируется' ? (
              <>
                <Notice>
                  Планируемая мера указывается только при наличии документа-основания, в том числе на этапе
                  очереди на 1–3 года.
                </Notice>
                <div className="fp-fields">
                  <Field
                    label="Предполагаемый год приобретения"
                    value={housingYear}
                    onChange={setHousingYear}
                    required
                    error={
                      !/^20\d{2}$/.test(housingYear) ? 'Укажите предполагаемый год, например 2028' : undefined
                    }
                  />
                  <Field label="Статус меры" value="В очереди · получение планируется" />
                  <Field
                    label="Документальное основание"
                    value="Учебное решение № Ж-09 от 31.10.2026"
                    required
                    wide
                  />
                </div>
                <FileRow
                  name="Решение_жилищная_очередь.pdf"
                  note="Документ-основание планируемой меры · демо"
                  required
                  onPreview={showDocument}
                />
              </>
            ) : (
              <>
                <div className="fp-fields">
                  <Field
                    label="Вид меры"
                    value="Субсидия"
                    options={[
                      'Субсидия',
                      'Компенсация',
                      'Предоставление жилья',
                      'Кредит · учитывается отдельно'
                    ]}
                    required
                  />
                  <Field label="Основание назначения" value="Учебный правовой акт или договор" required />
                  <Field label="Дата решения" value="02.10.2024" required />
                  <Field label="Дата приобретения" value="12.11.2024" required />
                </div>
                <UploadBox label="Документ полученной жилищной меры" />
              </>
            )}
          </Panel>
          <Panel>
            <PanelTitle title="Учитывается не как полученный доход" />
            <div className="fp-housing-visual">
              <span>
                <Home size={29} />
              </span>
              <div>
                <strong>
                  {housingAnswer === 'Планируется' ? 'Планируемая мера' : 'Вид жилищной меры'} → отдельная
                  запись
                </strong>
                <p>План, субсидия, кредит и предоставление жилья не объединяются в одну денежную выплату.</p>
              </div>
              <Badge tone="blue">Не суммировать автоматически</Badge>
            </div>
          </Panel>
        </div>
        <div className="fp-stack">
          <Panel className="fp-privacy-card">
            <Home size={29} />
            <h2>Готовимся заранее</h2>
            <p>
              Профиль помогает не забыть уже оформленное основание, даже если получение жилья ожидается через
              несколько лет.
            </p>
            <div className="fp-privacy-line">
              <CalendarDays size={17} />
              Год — предполагаемый, не дата выплаты
            </div>
          </Panel>
          <Notice tone="neutral">
            Банковские выписки и справки по счетам сюда не прикрепляются. Приложение не дублирует проверку
            банковских сведений.
          </Notice>
          <button
            className="fp-button fp-full"
            onClick={() => {
              log('Сохранены сведения о жилищной мере', 'private')
              navigate('payments')
            }}
          >
            <Check size={16} />
            Сохранить и вернуться
          </button>
        </div>
      </div>
    </>
  )
}

export function ActivitiesScreen(m: ProfileModel) {
  const {
    activityAnswer,
    setActivityAnswer,
    question,
    showDocument,
    activities,
    addActivity,
    updateActivity,
    removeActivity
  } = m
  return (
    <div className="fp-columns fp-form-columns">
      <div className="fp-stack">
        <Panel>
          <PanelTitle eyebrow="ЭТАП 90%" title="Экспертная и преподавательская работа" />
          <div className="fp-question">
            <strong>Участвуете ли вы в такой деятельности?</strong>
            <Choice value={activityAnswer} onChange={setActivityAnswer} />
          </div>
          {activityAnswer === 'Да' ? (
            <>
              <div className="fp-fields">
                <Field label="Организация" value="Учебный университет" required wide />
                <Field
                  label="Вид деятельности"
                  value="Преподавание"
                  options={['Преподавание', 'Экспертиза', 'Консультирование', 'Участие в комиссии', 'Иное']}
                  required
                />
                <Field
                  label="Вид оформления"
                  value="Гражданско-правовой договор"
                  options={[
                    'Трудовой договор',
                    'Срочный трудовой договор',
                    'Совместительство',
                    'Гражданско-правовой договор',
                    'Безвозмездная деятельность'
                  ]}
                  required
                />
                <Field label="Начало периода" value="01.04.2025" required />
                <Field label="Окончание периода" value="30.06.2025" required />
                <Field
                  label="Наименование и реквизиты основания"
                  value="Договор № П-18/25 от 24.03.2025"
                  required
                  wide
                />
              </div>
              <FileRow
                name="Договор_преподавание.pdf"
                note="Договор или приказ · учебный документ"
                required
                onPreview={showDocument}
              />
              {activities.map((activity) => (
                <div className="fp-crud-row" key={activity.id}>
                  <Field
                    label="Организация"
                    value={activity.organization}
                    onChange={(value) => updateActivity(activity.id, 'organization', value)}
                    wide
                  />
                  <Field
                    label="Вид деятельности"
                    value={activity.kind}
                    onChange={(value) => updateActivity(activity.id, 'kind', value)}
                  />
                  <Field
                    label="Период"
                    value={activity.period}
                    onChange={(value) => updateActivity(activity.id, 'period', value)}
                  />
                  <button
                    className="fp-icon-button"
                    aria-label="Удалить деятельность"
                    onClick={() => removeActivity(activity.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button className="fp-text-button" onClick={addActivity}>
                <Plus size={15} />
                Добавить деятельность
              </button>
            </>
          ) : (
            <Notice tone="teal">Ответ «Нет» дан. Поля дополнительной деятельности закрыты.</Notice>
          )}
        </Panel>
        <Panel>
          <PanelTitle
            title="Периоды рядом"
            subtitle="Пересечение помогает сформулировать вопрос, а не обвинение"
          />
          <div className="fp-period-chart">
            <div>
              <span>Основная служба</span>
              <div>
                <i className="fp-period-service">01.06.2023 — 31.08.2025</i>
              </div>
            </div>
            <div>
              <span>Преподавание</span>
              <div>
                <i className="fp-period-teaching">01.04 — 30.06.2025</i>
              </div>
            </div>
          </div>
          <Notice tone="amber">
            Уточните, требовалось ли уведомление и соблюдены ли применимые условия. Само пересечение периодов
            не является выводом о нарушении.
          </Notice>
        </Panel>
      </div>
      <div className="fp-stack">
        <Panel className="fp-explain-card">
          <span className="fp-explain-symbol">
            <GraduationCap size={26} />
          </span>
          <h2>Что сопоставляется</h2>
          <ul className="fp-check-points">
            <li>
              <Check size={16} />
              Организация в анкете и договоре
            </li>
            <li>
              <Check size={16} />
              Вид договора и документ-основание
            </li>
            <li>
              <Check size={16} />
              Даты деятельности и службы
            </li>
            <li>
              <Check size={16} />
              Основание возможного уведомления
            </li>
          </ul>
          <p>Правовые условия требуют оценки специалиста. В макете нет юридического решения от ИИ.</p>
        </Panel>
        <Notice tone="neutral">
          Безвозмездная деятельность тоже может быть указана. Она не превращается в денежную выплату
          автоматически.
        </Notice>
      </div>
    </div>
  )
}

export function DocumentsScreen(m: ProfileModel) {
  const { supportFile, documentCount, navigate, showDocument, attachments, addAttachment, removeAttachment } = m
  return (
    <>
      <Notice icon={<ShieldCheck size={19} />}>
        <strong>Разрешены документы-основания, не банковские счета.</strong> Произвольное распознавание, OCR и
        получение закрытых сведений в этом макете не выполняются.
      </Notice>
      <div className="fp-columns fp-documents-columns">
        <Panel>
          <PanelTitle
            title="Файлы и связанные разделы"
            subtitle={`${documentCount} учебных документов · добавлены пользователем`}
            action={
              <Badge tone={supportFile ? 'teal' : 'amber'}>
                {supportFile ? 'Комплект заполнен' : 'Не хватает 1 основания'}
              </Badge>
            }
          />
          <div className="fp-document-table">
            {documents.map(([name, section]) => (
              <FileRow key={name} name={name} note={section} onPreview={showDocument} />
            ))}
            {supportFile ? (
              <FileRow name={supportFile} note="Региональная поддержка" required onPreview={showDocument} />
            ) : (
              <div className="fp-document-missing">
                <AlertCircle size={19} />
                <div>
                  <strong>Региональная поддержка</strong>
                  <small>Документ-основание обязателен, но пока не добавлен</small>
                </div>
                <button className="fp-text-button" onClick={() => navigate('support')}>
                  Прикрепить
                  <ArrowRight size={14} />
                </button>
              </div>
            )}
            {attachments.map((attachment) => (
              <div className="fp-file" key={attachment.id}>
                <span className="fp-file-icon">
                  <FileText size={21} />
                </span>
                <div>
                  <strong>{attachment.name}</strong>
                  <small>Добавлено пользователем</small>
                </div>
                <button
                  className="fp-icon-button"
                  aria-label={`Просмотреть ${attachment.name}`}
                  onClick={() => showDocument(attachment.name)}
                >
                  <ChevronRight size={17} />
                </button>
                <button
                  className="fp-icon-button"
                  aria-label={`Удалить ${attachment.name}`}
                  onClick={() => removeAttachment(attachment.id)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <UploadBox label="Дополнительный документ основания" optional onUpload={addAttachment} />
          </div>
        </Panel>
        <div className="fp-stack">
          <Panel>
            <PanelTitle title="Источники сведений" />
            <div className="fp-source-row">
              <FileText size={20} />
              <div>
                <strong>Ручная загрузка</strong>
                <small>Подготовленные документы резервиста</small>
              </div>
              <Badge tone="teal">Доступна</Badge>
            </div>
            <div className="fp-source-row">
              <Landmark size={20} />
              <div>
                <strong>Ведомственные источники</strong>
                <small>Интеграция в макете не подключена</small>
              </div>
            </div>
            <Notice tone="neutral">
              <strong>Сведения не получены</strong>
              <br />
              Нет ответа источника ≠ нет дохода или выплаты.
            </Notice>
          </Panel>
          <Panel>
            <PanelTitle title="Когда справка не нужна" />
            <div className="fp-document-exception">
              <CheckCircle2 size={18} />
              <div>
                <strong>Пенсии и социальные выплаты</strong>
                <small>Ответ «Да / Нет» обязателен, документ не требуется</small>
              </div>
            </div>
            <div className="fp-document-exception">
              <Info size={18} />
              <div>
                <strong>Единовременная выплата</strong>
                <small>Документ прикладывается при наличии</small>
              </div>
            </div>
          </Panel>
          <button className="fp-button fp-full" onClick={() => navigate('selfcheck')}>
            Проверить комплект
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  )
}

export function SelfCheckScreen(m: ProfileModel) {
  const {
    phase,
    housingYear,
    housingAnswer,
    selfCheckReport,
    activityAnswer,
    consent,
    setConsent,
    corrected,
    ready,
    sent,
    version,
    documentCount,
    profileStatus,
    navigate,
    repeatSelfCheck,
    submit
  } = m
  const locked = sent && phase !== 'clarification'
  const report = selfCheckReport
  const rows = [
    ['Личность, программа и включение в резерв', 'Обязательные сведения и диплом заполнены', true, 'profile'],
    ['Служба, родство и получатели', 'Периоды и минимальные связи указаны', true, 'kinship'],
    ['Ответы по категориям', '10 из 10 блоков · уровни поддержки указаны отдельно', true, 'payments'],
    [
      'Основание региональной поддержки',
      report.support ? 'Документ добавлен' : 'Нужен документ органа назначения',
      report.support,
      'support'
    ],
    [
      'Планируемая жилищная мера',
      housingAnswer === 'Нет'
        ? 'Ответ «Нет» · дополнительные сведения не требуются'
        : report.housing
          ? `Предполагаемый год: ${housingYear} · документ добавлен`
          : 'Не указан предполагаемый год приобретения',
      report.housing,
      'housing'
    ],
    [
      'Дополнительная деятельность',
      activityAnswer === 'Нет'
        ? 'Ответ «Нет» · дополнительные сведения не требуются'
        : 'Организация, договор и период заполнены',
      true,
      'activities'
    ]
  ]
  return (
    <>
      <div className={`fp-readiness ${report.missing === 0 ? 'fp-readiness-ready' : ''}`}>
        <span className="fp-readiness-icon">
          {report.missing === 0 ? <CheckCircle2 size={32} /> : <ClipboardCheck size={32} />}
        </span>
        <div>
          <h2>{locked ? 'Версия передана на рассмотрение' : 'Комплектность сведений'}</h2>
          <p>
            {locked
              ? 'Проверяющему доступна только отправленная версия.'
              : 'Проверьте полноту и достоверность представленных сведений.'}
          </p>
        </div>
        <div className="fp-readiness-score" aria-label={`Готово ${report.completed} из 6 блоков`}>
          <strong>
            {report.completed}
            <small> / 6</small>
          </strong>
          <span>блоков готовы</span>
        </div>
        {!locked && (
          <button
            className="fp-refresh-button"
            aria-label="Повторить самопроверку"
            title="Проверить снова"
            onClick={repeatSelfCheck}
          >
            <RotateCw size={22} />
          </button>
        )}
      </div>
      <div className="fp-columns fp-form-columns">
        <div className="fp-stack">
          <Panel>
            <PanelTitle title="Обязательные сведения" />
            <div className="fp-checklist">
              {rows.map(([title, note, ok, target]) => (
                <div key={String(title)} className={`fp-check-row ${ok ? 'ok' : 'error'}`}>
                  <span>{ok ? <Check size={18} /> : <AlertCircle size={18} />}</span>
                  <div>
                    <strong>{String(title)}</strong>
                    <small>{String(note)}</small>
                  </div>
                  {ok ? (
                    <Badge tone="teal">Готово</Badge>
                  ) : (
                    <button className="fp-text-button" onClick={() => navigate(target as Screen)}>
                      Исправить
                      <ChevronRight size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </Panel>
          <button className="fp-text-button fp-instruction-link" onClick={() => navigate('instructions')}>
            <BookOpen size={16} />
            Требования к документам и исключения
            <ArrowRight size={14} />
          </button>
        </div>
        <Panel className="fp-submit-card">
          <PanelTitle
            title={locked ? 'Представленная версия' : 'Передача сведений'}
            eyebrow={corrected ? 'УТОЧНЁННАЯ ВЕРСИЯ 2' : 'ВЕРСИЯ 1'}
          />
          <div className="fp-key-row">
            <span>Ответов по блокам</span>
            <strong>10 / 10</strong>
          </div>
          <div className="fp-key-row">
            <span>Записей и мер</span>
            <strong>{corrected ? 7 : 8}</strong>
          </div>
          <div className="fp-key-row">
            <span>Документов</span>
            <strong>{documentCount}</strong>
          </div>
          <div className="fp-key-row">
            <span>Получателей</span>
            <strong>Резервист + 1 член семьи</strong>
          </div>
          <div className="fp-divider" />
          {locked ? (
            <>
              <Badge tone="teal">
                <CheckCircle2 size={14} />
                {profileStatus}
              </Badge>
              <p>Версия {version} зафиксирована 08.11.2026 в 10:42.</p>
              <button className="fp-button fp-button-outline fp-full" onClick={() => navigate('messages')}>
                Статус и уточнения
                <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <label className="fp-checkbox">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  Я проверил сведения и подтверждаю передачу этой версии уполномоченному специалисту
                </span>
              </label>
              <button className="fp-button fp-full" onClick={submit} disabled={!ready || !consent}>
                <Send size={16} />
                Отправить на проверку
              </button>
              <small className="fp-submit-note">
                <LockKeyhole size={13} />
                Личный черновик и подсказки не передаются
              </small>
            </>
          )}
        </Panel>
      </div>
    </>
  )
}

export function QueueScreen(m: ProfileModel, onQuickLogin?: () => void) {
  const {
    phase,
    sent,
    candidate,
    presented,
    accepted,
    query,
    setQuery,
    queueFilter,
    setQueueFilter,
    setToast,
    version,
    presentedCorrected,
    navigate
  } = m
  const allRows = [
    ...(presented
      ? [
          {
            id: profileId,
            name: person,
            initials: 'АК',
            program: presented.candidate.regionalProgram
              ? `«${presented.candidate.regionalProgram}» · ${presented.candidate.regionalProgramYear}`
              : `«Время героев» · ${presented.candidate.flow.toLowerCase()} · ${presented.candidate.programYear}`,
            version: presented.version,
            date: '08.11.2026 · 10:42',
            signals: presentedCorrected ? 'Уточнённая версия' : '3 вопроса',
            status:
              phase === 'completed'
                ? 'Рассмотрение завершено'
                : phase === 'removed'
                  ? 'Снят с рассмотрения'
                  : phase === 'clarification'
                    ? 'Требуется уточнение'
                    : accepted
                      ? 'Принят к рассмотрению'
                      : 'Поступило',
            main: true
          }
        ]
      : []),
    {
      id: 'РВ-2026-0139',
      name: 'Волкова Ирина Михайловна',
      initials: 'ИВ',
      program: '«Время героев» · поток 1',
      version: 1,
      date: '07.11.2026 · 16:10',
      signals: '1 вопрос',
      status: 'Требуется уточнение',
      main: false
    },
    {
      id: 'РВ-2026-0128',
      name: 'Орлов Денис Андреевич',
      initials: 'ДО',
      program: '«Герои Липецкой земли» · 2025',
      version: 2,
      date: '06.11.2026 · 11:25',
      signals: 'Вопросы рассмотрены',
      status: 'Рассмотрение завершено',
      main: false
    }
  ]
  const filtered = allRows.filter(
    (row) =>
      `${row.name} ${row.id}`.toLowerCase().includes(query.toLowerCase()) &&
      (queueFilter === 'Все' ||
        (queueFilter === 'Поступило'
          ? row.status === 'Поступило'
          : queueFilter === 'На уточнении'
            ? row.status === 'Требуется уточнение'
            : row.status === 'Рассмотрение завершено'))
  )
  return (
    <>
      <div className="fp-stats">
        <Panel className="fp-stat">
          <span className="fp-stat-icon fp-blue">
            <Inbox size={23} />
          </span>
          <div>
            <strong>{allRows.length}</strong>
            <span>назначено вам</span>
          </div>
        </Panel>
        <Panel className="fp-stat">
          <span className="fp-stat-icon fp-teal">
            <Send size={23} />
          </span>
          <div>
            <strong>{allRows.filter((row) => row.status === 'Поступило').length}</strong>
            <span>новых материалов</span>
          </div>
        </Panel>
        <Panel className="fp-stat">
          <span className="fp-stat-icon fp-amber">
            <MessageSquareText size={23} />
          </span>
          <div>
            <strong>{allRows.filter((row) => row.status === 'Требуется уточнение').length}</strong>
            <span>на уточнении</span>
          </div>
        </Panel>
        <Panel className="fp-stat">
          <span className="fp-stat-icon fp-neutral">
            <BadgeCheck size={23} />
          </span>
          <div>
            <strong>{allRows.filter((row) => row.status === 'Рассмотрение завершено').length}</strong>
            <span>рассмотрение завершено</span>
          </div>
        </Panel>
      </div>
      <Panel className="fp-queue-panel">
        <PanelTitle
          title="Назначенные материалы"
          subtitle="Количество рассчитано по показанному учебному списку"
          action={
            <label className="fp-search">
              <Search size={18} />
              <input
                aria-label="Поиск материалов"
                placeholder="ФИО или номер профиля"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          }
        />
        <div className="fp-table-tabs">
          {['Все', 'Поступило', 'На уточнении', 'Завершено'].map((tab) => (
            <button
              key={tab}
              className={tab === queueFilter ? 'active' : ''}
              onClick={() => setQueueFilter(tab)}
            >
              {tab}
              {tab === 'Все' && <span>{allRows.length}</span>}
            </button>
          ))}
          <button
            className="fp-table-filter"
            onClick={() => setToast('Используйте вкладки статусов и поиск')}
          >
            <SlidersHorizontal size={15} />
            Фильтры
          </button>
        </div>
        <div className="fp-table-scroll">
          <table className="fp-table">
            <thead>
              <tr>
                <th>Профиль</th>
                <th>Резервист</th>
                <th>Представлено</th>
                <th>Сопоставление</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong className="fp-table-id">{row.id}</strong>
                    <small>Версия {row.version}</small>
                  </td>
                  <td>
                    <div className="fp-table-person">
                      <span className="fp-avatar">{row.initials}</span>
                      <div>
                        <strong>{row.name}</strong>
                        <small>{row.program}</small>
                      </div>
                    </div>
                  </td>
                  <td>{row.date}</td>
                  <td>
                    <Badge
                      tone={row.signals === '3 вопроса' || row.signals === '1 вопрос' ? 'amber' : 'blue'}
                    >
                      {row.signals}
                    </Badge>
                  </td>
                  <td>
                    <Badge
                      tone={
                        row.status === 'Рассмотрение завершено'
                          ? 'teal'
                          : row.status === 'Требуется уточнение'
                            ? 'amber'
                            : 'blue'
                      }
                    >
                      {row.status}
                    </Badge>
                  </td>
                  <td>
                    <button
                      className="fp-icon-button"
                      aria-label={`Открыть ${row.id}`}
                      onClick={() =>
                        row.main
                          ? navigate('case')
                          : setToast('Для подробного сценария используйте профиль Алексея Ковалёва')
                      }
                    >
                      <ChevronRight size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fp-table-footer">
          <span>
            Показано {filtered.length} из {allRows.length} · только вымышленные сведения
          </span>
          <span>Страница 1 из 1</span>
        </div>
      </Panel>
      <div className="fp-columns fp-queue-bottom">
        <Notice icon={<LockKeyhole size={20} />}>
          <strong>Черновики не поступают в очередь.</strong>
          <br />
          Материал появляется только после отправки резервистом и назначения вам доступа.
          {!sent && onQuickLogin && (
            <div className="fp-queue-hint">
              <span>Пока вы видите только учебные заглушки. Отправьте версию как резервист, чтобы открыть сценарий.</span>
              <button className="fp-button fp-button-outline" onClick={onQuickLogin}>
                <UserRound size={15} /> Войти как резервист
              </button>
            </div>
          )}
        </Notice>
        <Panel>
          <PanelTitle title="Порядок приёма" />
          <div className="fp-inline-steps">
            <span>
              <i>1</i>Комплектность
            </span>
            <ChevronRight size={15} />
            <span>
              <i>2</i>Сопоставление
            </span>
            <ChevronRight size={15} />
            <span>
              <i>3</i>Обоснованный статус
            </span>
          </div>
        </Panel>
      </div>
    </>
  )
}

export function CaseScreen(m: ProfileModel) {
  const {
    phase,
    presented,
    accepted,
    setAccepted,
    housingAnswer,
    setSelectedSignal,
    setReviewComment,
    question,
    signalDecisions,
    completeness,
    version,
    presentedCorrected,
    visibleCandidate,
    documentCount,
    log,
    navigate,
    nav
  } = m
  const corrected = presentedCorrected
  const housingYear = presented?.housingYear || ''
  const reviewedCount = Object.values(signalDecisions).filter(
    (decision) => decision.status === 'Рассмотрено' || decision.status === 'Исключено с обоснованием'
  ).length
  return (
    <>
      <button className="fp-back" onClick={() => navigate('queue')}>
        <ArrowLeft size={15} />К очереди материалов
      </button>
      <PersonHeader
        status={
          phase === 'completed'
            ? 'Рассмотрение завершено'
            : phase === 'clarification'
              ? 'Требуется уточнение'
              : accepted
                ? 'Принят к рассмотрению'
                : 'Сведения представлены'
        }
        tone={phase === 'clarification' ? 'amber' : 'teal'}
        version={`представленная версия ${version}`}
        details={visibleCandidate}
      >
        <div className="fp-case-counters">
          <div>
            <span>Документов</span>
            <strong>{documentCount}</strong>
          </div>
          <div>
            <span>Рассмотрено v1</span>
            <strong>
              {reviewedCount} <small>/ 3</small>
            </strong>
          </div>
        </div>
        <button
          className="fp-button"
          onClick={() => {
            if (accepted) navigate('signals')
            else {
              setAccepted(true)
              log('Материал принят к рассмотрению после проверки комплектности', 'submitted')
            }
          }}
        >
          {accepted ? 'Сопоставить' : 'Принять к рассмотрению'}
          <ArrowRight size={16} />
        </button>
      </PersonHeader>
      <div className="fp-case-nav">
        <button className="active">Обзор материала</button>
        <button onClick={() => navigate('signals')}>
          Возможные несоответствия<Badge tone="amber">3</Badge>
        </button>
        <button onClick={() => navigate('history')}>История версий</button>
        <button onClick={() => navigate('result')}>Результат рассмотрения</button>
        <span>
          <LockKeyhole size={14} />
          Только представленная версия
        </span>
      </div>
      <div className="fp-columns fp-case-columns">
        <div className="fp-stack">
          <Panel>
            <PanelTitle
              title={accepted ? 'Комплектность проверена' : 'Представленные сведения'}
              action={
                <Badge tone="teal">
                  <Check size={13} />
                  Полный комплект
                </Badge>
              }
            />
            <div className="fp-case-facts">
              <div>
                <span>Текущая работа</span>
                <strong>Учебный центр «Регион»</strong>
              </div>
              <div>
                <span>Статус</span>
                <strong>Находится в запасе</strong>
              </div>
              <div>
                <span>Период военной службы</span>
                <strong>01.06.2023 — 31.08.2025</strong>
              </div>
              <div>
                <span>Офицерский состав</span>
                <strong>Старший</strong>
              </div>
              <div>
                <span>Родство с участником СВО</span>
                <strong>Да · родитель · участвовал</strong>
              </div>
              <div>
                <span>Получал за родственника</span>
                <strong>Да · решение № К-24</strong>
              </div>
              <div className="fp-case-fact-wide">
                <span>Предполагаемый орган назначения</span>
                <strong>{visibleCandidate.appointmentAuthority || 'Не указан'}</strong>
              </div>
            </div>
            <div className="fp-completeness-strip">
              <span>
                <CheckCircle2 size={16} />
                10 из 10 ответов даны
              </span>
              <span>
                <CheckCircle2 size={16} />
                Обязательные основания приложены
              </span>
            </div>
          </Panel>
          <Panel>
            <PanelTitle
              title="Представленные сведения о доходах"
              subtitle="Суммы из записей, не подтверждённый доход для «Справок БК»"
            />
            <div className="fp-financial-cards">
              <div>
                <span className="fp-financial-icon fp-teal">
                  <UserRound size={21} />
                </span>
                <small>Денежные записи резервиста</small>
                <strong>
                  {corrected ? '2 430 000' : '2 580 000'} <span>₽</span>
                </strong>
                <p>
                  {corrected ? '4 записи · возможный дубль удалён' : '5 записей · возможный дубль не вычтен'}
                </p>
              </div>
              <div>
                <span className="fp-financial-icon fp-blue">
                  <UsersRound size={21} />
                </span>
                <small>Отдельно: член семьи</small>
                <strong>
                  120 000 <span>₽</span>
                </strong>
                <p>Мария Ковалёва · не личный доход резервиста</p>
              </div>
            </div>
            <div className="fp-noncash-row">
              {presented?.housingAnswer !== 'Нет' && (
                <div>
                  <Home size={21} />
                  <span>
                    <strong>Жилищная мера · планируется в {housingYear}</strong>
                    <small>Решение № Ж-09 · не полученные деньги</small>
                  </span>
                </div>
              )}
              <div>
                <BriefcaseBusiness size={21} />
                <span>
                  <strong>Помощь фонда · натуральная форма</strong>
                  <small>Учебный ноутбук · отдельно от денежных выплат</small>
                </span>
              </div>
            </div>
          </Panel>
        </div>
        <div className="fp-stack">
          <Panel className="fp-question-card">
            <PanelTitle
              title={corrected ? 'Вопросы версии 1 сохранены' : 'Вопросы для уточнения'}
              action={<span className="fp-count-bubble">3</span>}
            />
            {signalDefinitions.map((signal, index) => (
              <button
                className="fp-mini-signal"
                key={signal.code}
                onClick={() => {
                  setSelectedSignal(index)
                  setReviewComment('')
                  navigate('signals')
                }}
              >
                <div>
                  <small>{signal.code}</small>
                  <strong>{signal.title}</strong>
                  <Badge
                    tone={
                      signalDecisions[index]?.status === 'Рассмотрено'
                        ? 'teal'
                        : signalDecisions[index]
                          ? 'blue'
                          : 'amber'
                    }
                  >
                    {signalDecisions[index]?.status || 'Не рассмотрено'}
                  </Badge>
                </div>
                <ChevronRight size={15} />
              </button>
            ))}
          </Panel>
          <Notice tone="blue">
            Дата перечисления 18.09.2025 позднее окончания службы. Период основания заканчивается 31.08.2025 —
            прямое противоречие дат не сформировано.
          </Notice>
          <button className="fp-button fp-button-outline fp-full" onClick={() => navigate('result')}>
            Зафиксировать результат
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  )
}

export function SignalsScreen(m: ProfileModel) {
  const {
    selectedSignal,
    setSelectedSignal,
    reviewComment,
    setReviewComment,
    signalDecisions,
    presentedCorrected,
    recordSignalDecision,
    requestClarification
  } = m
  const corrected = presentedCorrected
  const signal = signalDefinitions[selectedSignal]
  const decision = signalDecisions[selectedSignal]
  const reviewedCount = Object.values(signalDecisions).filter(
    (item) => item.status === 'Рассмотрено' || item.status === 'Исключено с обоснованием'
  ).length
  return (
    <>
      <div className="fp-material-strip">
        <div>
          <span className="fp-avatar">АК</span>
          <div>
            <strong>{person}</strong>
            <small>{profileId} · представленная версия 1 · правила макета 0.2</small>
          </div>
        </div>
        <Badge tone="blue">Рассмотрено {reviewedCount} из 3</Badge>
      </div>
      {corrected && (
        <Notice tone="blue">
          Показаны исходные вопросы версии 1. Уточнённая версия 2 не переписывает прежние основания и
          комментарии.
        </Notice>
      )}
      <div className="fp-signal-layout">
        <div className="fp-stack">
          <div className="fp-list-caption">
            ВОПРОСЫ ПО МАТЕРИАЛУ<span>3</span>
          </div>
          {signalDefinitions.map((item, index) => (
            <button
              key={item.code}
              className={`fp-signal-item ${selectedSignal === index ? 'active' : ''}`}
              onClick={() => {
                setSelectedSignal(index)
                setReviewComment('')
              }}
            >
              <span className="fp-signal-item-code">
                {item.code}
                <small>{item.type}</small>
              </span>
              <h2>{item.title}</h2>
              <div>
                <Badge
                  tone={
                    signalDecisions[index]?.status === 'Рассмотрено'
                      ? 'teal'
                      : signalDecisions[index]
                        ? 'blue'
                        : 'amber'
                  }
                >
                  {signalDecisions[index]?.status === 'Рассмотрено' && <CheckCircle2 size={13} />}
                  {signalDecisions[index]?.status || 'Не рассмотрено'}
                </Badge>
                <span>
                  2 основания
                  <ChevronRight size={14} />
                </span>
              </div>
            </button>
          ))}
          <Notice tone="neutral">
            Возможное несоответствие не является выводом о нарушении. Результат сопоставления фиксируется с
            комментарием специалиста.
          </Notice>
        </div>
        <Panel className="fp-signal-detail">
          <PanelTitle
            eyebrow={`${signal.code} · ПРАВИЛО СОПОСТАВЛЕНИЯ`}
            title={signal.title}
            action={
              <span className="fp-detail-mark">
                <Link2 size={22} />
              </span>
            }
          />
          <div className="fp-review-reason">
            <AlertCircle size={21} />
            <div>
              <strong>Основание для уточнения</strong>
              <p>{signal.text}</p>
            </div>
          </div>
          <div className="fp-evidence-grid">
            {[
              [signal.leftTitle, signal.left],
              [signal.rightTitle, signal.right]
            ].map(([title, rows], index) => (
              <article key={String(title)} className={index ? 'fp-evidence-document' : ''}>
                <span className="fp-evidence-label">
                  {index ? 'ДОКУМЕНТ-ОСНОВАНИЕ' : 'ПРЕДСТАВЛЕННЫЕ СВЕДЕНИЯ'}
                </span>
                <h3>{String(title)}</h3>
                <dl>
                  {(rows as string[][]).map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
          <div className="fp-document-quote">
            <FileText size={18} />
            <div>
              <span>Фрагмент учебного документа</span>
              <blockquote>{signal.quote}</blockquote>
            </div>
          </div>
          <div className="fp-review-followup">
            <strong>Что сопоставить</strong>
            <p>{signal.action}</p>
          </div>
          {decision && (
            <div className="fp-review-record">
              <div>
                <Badge tone={decision.status === 'Рассмотрено' ? 'teal' : 'blue'}>{decision.status}</Badge>
                <small>Анна Иванова · версия 1</small>
              </div>
              <p>{decision.comment}</p>
            </div>
          )}
          <div className="fp-decision-form">
            <h3>Результат сопоставления</h3>
            <label className="fp-field">
              <span className="fp-field-label">
                Комментарий и вопрос резервисту<em> *</em>
              </span>
              <textarea
                aria-label="Комментарий и вопрос резервисту"
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Укажите сопоставленные сведения и конкретный вопрос…"
                rows={3}
              />
            </label>
            <div className="fp-decision-actions">
              <button
                className="fp-button"
                disabled={reviewComment.trim().length < 5}
                onClick={requestClarification}
              >
                <MessageSquareText size={16} />
                Запросить уточнение
              </button>
              <button
                className="fp-button fp-button-outline"
                disabled={reviewComment.trim().length < 5}
                onClick={() => recordSignalDecision('Рассмотрено')}
              >
                <CheckCircle2 size={15} />
                Отметить рассмотренным
              </button>
              <button
                className="fp-text-button"
                disabled={reviewComment.trim().length < 5}
                onClick={() => recordSignalDecision('Исключено с обоснованием')}
              >
                Исключить вопрос
              </button>
            </div>
            <small>Отметка «Рассмотрено» фиксирует работу специалиста, но не решение о назначении.</small>
          </div>
        </Panel>
      </div>
    </>
  )
}

export function MessagesScreen(m: ProfileModel) {
  const {
    role,
    phase,
    presented,
    question,
    setReply,
    correctionChecks,
    setCorrectionChecks,
    sent,
    version,
    privateReply,
    navigate,
    prepareCorrection
  } = m
  const reply = role === 'reviewer' ? presented?.reply || '' : privateReply
  if (!question)
    return (
      <Panel className="fp-empty">
        <span className="fp-empty-icon">
          <MessageSquareText size={34} />
        </span>
        <h2>Запросов уточнения пока нет</h2>
        <p>
          {sent
            ? 'Если специалист задаст вопрос, он появится здесь вместе с указанием версии.'
            : 'Сначала завершите профиль и отправьте сведения на проверку.'}
        </p>
        <button
          className="fp-button"
          onClick={() => navigate(role === 'reservist' ? 'selfcheck' : 'signals')}
        >
          Продолжить
          <ArrowRight size={16} />
        </button>
      </Panel>
    )
  return (
    <>
      <div className="fp-material-strip">
        <div>
          <span className="fp-avatar">АК</span>
          <div>
            <strong>{person}</strong>
            <small>{profileId} · запрос № УТ-0147-01 по версии 1</small>
          </div>
        </div>
        <Badge tone={phase === 'completed' ? 'teal' : 'amber'}>
          {phase === 'completed' ? 'Рассмотрение завершено' : 'Требуется уточнение'}
        </Badge>
      </div>
      <div className="fp-columns fp-message-columns">
        <div className="fp-stack">
          <Panel>
            <PanelTitle
              title="Вопрос уполномоченного специалиста"
              subtitle="Анна Иванова · кадровый специалист · 08.11.2026, 10:42"
              action={<Badge tone="blue">Версия 1</Badge>}
            />
            <div className="fp-formal-question">
              <MessageSquareText size={23} />
              <p>{question}</p>
            </div>
            <div className="fp-request-topics">
              <Badge tone="neutral">РО-01 · связь с родственником</Badge>
              <Badge tone="neutral">ДУ-01 · возможный дубль</Badge>
              <Badge tone="neutral">ДЕ-01 · договор и период</Badge>
            </div>
          </Panel>
          {role === 'reservist' ? (
            <Panel>
              <PanelTitle
                title="Ответ и уточнённые сведения"
                subtitle="Изменения сохраняются в новом личном черновике версии 2"
              />
              <label className="fp-field">
                <span className="fp-field-label">
                  Пояснение резервиста<em> *</em>
                </span>
                <textarea
                  aria-label="Пояснение резервиста"
                  rows={4}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Поясните основание, повторный учёт и условия деятельности…"
                />
              </label>
              <div className="fp-correction-checks">
                {[
                  'Связь выплаты 320 000 ₽ с родственником уточнена',
                  'Повторная запись по назначению Н-42 исключена',
                  'Договор и вопрос об уведомлении сверены'
                ].map((text, index) => (
                  <label className="fp-checkbox" key={text}>
                    <input
                      type="checkbox"
                      checked={correctionChecks[index]}
                      onChange={(e) =>
                        setCorrectionChecks((previous) =>
                          previous.map((value, i) => (i === index ? e.target.checked : value))
                        )
                      }
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
              <button
                className="fp-button"
                onClick={prepareCorrection}
                disabled={reply.trim().length < 10 || !correctionChecks.every(Boolean)}
              >
                Подготовить версию 2<ArrowRight size={16} />
              </button>
            </Panel>
          ) : (
            <Panel>
              <PanelTitle title="Ответ резервиста" />
              {reply ? (
                <>
                  <p className="fp-reply-text">{reply}</p>
                  <Badge tone={phase === 'resubmitted' || phase === 'completed' ? 'teal' : 'amber'}>
                    {phase === 'resubmitted' || phase === 'completed'
                      ? 'Версия 2 представлена'
                      : 'Ответ готовится в личном черновике'}
                  </Badge>
                </>
              ) : (
                <div className="fp-waiting">
                  <Clock3 size={22} />
                  <div>
                    <strong>Ожидается ответ и новая версия</strong>
                    <p>Изменения в черновике резервиста вам недоступны.</p>
                  </div>
                </div>
              )}
            </Panel>
          )}
        </div>
        <div className="fp-stack">
          <Panel className="fp-version-card">
            <PanelTitle title="Версии не перезаписываются" />
            <div className="fp-version-line">
              <span>1</span>
              <div>
                <strong>Представленная версия 1</strong>
                <small>Сохранены исходные записи, вопросы и комментарии</small>
              </div>
              <LockKeyhole size={18} />
            </div>
            <div className="fp-version-line">
              <span>2</span>
              <div>
                <strong>
                  {phase === 'resubmitted' || phase === 'completed'
                    ? 'Представленная версия 2'
                    : 'Личный черновик версии 2'}
                </strong>
                <small>
                  {role === 'reviewer' && phase !== 'resubmitted' && phase !== 'completed'
                    ? 'Недоступен до повторной отправки'
                    : 'Уточнённое основание и ответ на вопросы'}
                </small>
              </div>
              <FileText size={18} />
            </div>
          </Panel>
          <Notice icon={<LockKeyhole size={19} />}>
            После исправлений резервист снова проходит проверку обязательных полей и отправляет новую
            зафиксированную версию.
          </Notice>
          <Panel>
            <PanelTitle title="Это рабочее уточнение" />
            <p>
              Вопрос технического заполнения можно адресовать кадровому помощнику по контактам внизу
              платформы.
            </p>
            <small>Платформа не подменяет установленный порядок обращений и официальных проверок.</small>
          </Panel>
        </div>
      </div>
    </>
  )
}

export function ResultScreen(m: ProfileModel) {
  const {
    phase,
    reply,
    reviewChecks,
    setReviewChecks,
    decisionComment,
    setDecisionComment,
    decisionBasis,
    setDecisionBasis,
    decisionFile,
    setDecisionFile,
    decisionStatus,
    setDecisionStatus,
    version,
    profileStatus,
    navigate,
    showDocument,
    complete,
    exportSummary
  } = m
  const finished = phase === 'completed' || phase === 'removed'
  return (
    <>
      <div className="fp-material-strip">
        <div>
          <span className="fp-avatar">АК</span>
          <div>
            <strong>{person}</strong>
            <small>
              {profileId} · представленная версия {version}
            </small>
          </div>
        </div>
        <button className="fp-button fp-button-outline" onClick={exportSummary}>
          <Download size={16} />
          Выгрузить учебный результат
        </button>
      </div>
      {finished ? (
        <>
          <Panel className="fp-result-banner">
            <span>
              <BadgeCheck size={36} />
            </span>
            <div>
              <Badge tone="teal">Статус зафиксирован</Badge>
              <h2>{profileStatus}</h2>
              <p>
                Статус отображается резервисту. Это результат рассмотрения сведений, не решение о назначении
                на должность.
              </p>
            </div>
            <div>
              <small>Уполномоченный специалист</small>
              <strong>Анна Иванова</strong>
              <small>08.11.2026 · 10:42</small>
            </div>
          </Panel>
          <div className="fp-columns fp-form-columns">
            <Panel>
              <PanelTitle title="Основание и комментарий" />
              <div className="fp-result-basis">
                <FileCheck2 size={26} />
                <div>
                  <strong>{decisionBasis}</strong>
                  <small>Подтверждающее основание внесено специалистом</small>
                </div>
              </div>
              <p className="fp-reply-text">{decisionComment}</p>
              <FileRow
                name={decisionFile}
                note="Подтверждающий документ результата · демо"
                onPreview={showDocument}
              />
              <div className="fp-divider" />
              <h3>Рассмотренные вопросы</h3>
              {[
                'Основание выплаты за родственника уточнено',
                'Возможный повторный учёт рассмотрен',
                'Договор и применимость уведомления проверены'
              ].map((text) => (
                <div className="fp-resolved-row" key={text}>
                  <CheckCircle2 size={18} />
                  <span>{text}</span>
                  <Badge tone="teal">Рассмотрено</Badge>
                </div>
              ))}
            </Panel>
            <div className="fp-stack">
              <Panel>
                <PanelTitle title="Сохранённая история" />
                <div className="fp-version-line">
                  <span>1</span>
                  <div>
                    <strong>Версия 1 · исходный материал</strong>
                    <small>3 вопроса и первоначальные записи сохранены</small>
                  </div>
                  <LockKeyhole size={18} />
                </div>
                <div className="fp-version-line">
                  <span>2</span>
                  <div>
                    <strong>Версия 2 · уточнённые сведения</strong>
                    <small>Основание связано с родственником, дубль исключён</small>
                  </div>
                  <CheckCircle2 size={18} />
                </div>
                <button className="fp-text-button" onClick={() => navigate('history')}>
                  Открыть журнал
                  <ArrowRight size={15} />
                </button>
              </Panel>
              <Notice tone="teal">
                Планируемое жильё и натуральная помощь остались отдельными мерами, выплаты супруге не включены
                в личные поступления резервиста.
              </Notice>
              <Notice tone="neutral">
                Юридически значимое решение о назначении принимается вне платформы в установленном порядке.
              </Notice>
            </div>
          </div>
        </>
      ) : (
        <div className="fp-columns fp-form-columns">
          <Panel>
            <PanelTitle
              title="Рассмотрение представленной версии"
              subtitle="Сначала подтвердите сопоставление, затем внесите основание статуса"
            />
            <div className="fp-result-checks">
              {[
                'Получатели и основания выплат сопоставлены',
                'Вопрос о повторном учёте рассмотрен',
                'Деятельность, периоды и документы проверены'
              ].map((text, index) => (
                <label className="fp-checkbox" key={text}>
                  <input
                    type="checkbox"
                    checked={reviewChecks[index]}
                    onChange={(e) =>
                      setReviewChecks((previous) =>
                        previous.map((value, i) => (i === index ? e.target.checked : value))
                      )
                    }
                  />
                  <span>{text}</span>
                </label>
              ))}
            </div>
            <Field
              label="Итоговый статус профиля"
              value={decisionStatus}
              options={['Рассмотрение завершено', 'Снят с рассмотрения обоснованием']}
              onChange={setDecisionStatus}
              required
            />
            <Field
              label="Реквизиты подтверждающего основания"
              value={decisionBasis}
              onChange={setDecisionBasis}
              required
              hint="Например, реквизиты согласованного результата рассмотрения"
            />
            <label className="fp-field">
              <span className="fp-field-label">
                Комментарий к результату<em> *</em>
              </span>
              <textarea
                aria-label="Комментарий к результату"
                rows={4}
                value={decisionComment}
                onChange={(e) => setDecisionComment(e.target.value)}
                placeholder="Укажите, что сопоставлено и на каком основании установлен статус…"
              />
            </label>
            {decisionFile ? (
              <FileRow name={decisionFile} />
            ) : (
              <UploadBox label="Подтверждающий документ результата" onUpload={setDecisionFile} />
            )}
            <button
              className="fp-button fp-full"
              disabled={
                !reviewChecks.every(Boolean) ||
                decisionComment.trim().length < 10 ||
                !decisionBasis.trim() ||
                !decisionFile
              }
              onClick={complete}
            >
              <BadgeCheck size={17} />
              Зафиксировать итоговый статус
            </button>
          </Panel>
          <div className="fp-stack">
            <Panel className="fp-privacy-card">
              <ShieldCheck size={28} />
              <h2>Решение принимает человек</h2>
              <p>
                Нет автоматического отказа по финансовым несовпадениям. Основание завершения или снятия с
                рассмотрения обязательно.
              </p>
              <div className="fp-privacy-line">
                <CheckCircle2 size={17} />
                Статус будет виден резервисту
              </div>
            </Panel>
            <Panel>
              <PanelTitle title="Рабочие состояния материала" />
              <ul className="fp-status-list">
                <li>
                  <Badge tone="blue">Принят к рассмотрению</Badge>
                </li>
                <li>
                  <Badge tone="amber">Требуются уточнения</Badge>
                </li>
                <li>
                  <Badge tone="neutral">Снят с рассмотрения обоснованием</Badge>
                </li>
                <li>
                  <Badge tone="teal">Рассмотрение завершено</Badge>
                </li>
              </ul>
            </Panel>
            <Notice tone="neutral">
              Все версии, комментарии, просмотры, загрузки и выгрузки фиксируются в демонстрационном журнале.
              Промышленная авторизация этим макетом не реализуется.
            </Notice>
          </div>
        </div>
      )}
    </>
  )
}

export function HistoryScreen(m: ProfileModel) {
  const { role, decisionBasis, audit, presentedCorrected, profileStatus } = m
  const corrected = presentedCorrected
  const visibleEvents = audit
    .filter((event) => role === 'reservist' || event.scope === 'submitted')
    .slice()
    .reverse()
  return (
    <>
      <div className="fp-history-versions">
        <Panel>
          <PanelTitle title="Представленная версия 1" action={<Badge tone="blue">Зафиксирована</Badge>} />
          <div className="fp-key-row">
            <span>Отправлено</span>
            <strong>08.11.2026 · 10:42</strong>
          </div>
          <div className="fp-key-row">
            <span>Записи / вопросы</span>
            <strong>8 / 3</strong>
          </div>
          <small>
            <LockKeyhole size={13} />
            Исходные сведения не изменены
          </small>
        </Panel>
        <Panel>
          <PanelTitle
            title={corrected ? 'Представленная версия 2' : 'Новая версия ещё не представлена'}
            action={
              <Badge tone={corrected ? 'teal' : 'neutral'}>{corrected ? profileStatus : 'Ожидание'}</Badge>
            }
          />
          <div className="fp-key-row">
            <span>Записи после уточнений</span>
            <strong>{corrected ? '7' : '—'}</strong>
          </div>
          <div className="fp-key-row">
            <span>Основание результата</span>
            <strong>{decisionBasis || 'Ещё не внесено'}</strong>
          </div>
          <small>Личные черновики в этот журнал не включаются</small>
        </Panel>
      </div>
      <Panel>
        <PanelTitle
          title="Журнал представленного материала"
          subtitle="Вход, просмотр, загрузка, выгрузка, комментарий и изменение статуса"
        />
        <div className="fp-table-scroll">
          <table className="fp-table fp-audit-table">
            <thead>
              <tr>
                <th>Дата и время</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Доступ</th>
              </tr>
            </thead>
            <tbody>
              {visibleEvents.slice(0, 10).map((event, index) => (
                <tr key={`${event.action}-${index}`}>
                  <td>{event.time}</td>
                  <td>{event.actor}</td>
                  <td>{event.action}</td>
                  <td>
                    <Badge tone="neutral">Представленный материал</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Notice icon={<LockKeyhole size={19} />}>
        Журнал резервиста может содержать личные действия. Проверяющему доступны только события
        представленного материала, а не содержание черновика и подсказок.
      </Notice>
    </>
  )
}

export function InstructionsScreen(m: ProfileModel) {
  return (
    <div className="fp-columns fp-form-columns">
      <div className="fp-stack">
        <Panel>
          <PanelTitle title="Этапы заполнения" />
          <ol className="fp-instruction-stages">
            {profileStages.map(([value, title]) => (
              <li key={value}>
                <strong>{value}%</strong>
                <span>{title}</span>
              </li>
            ))}
          </ol>
          <p className="fp-instruction-note">
            Проценты обозначают этапы подготовки сведений, а не оценку денежных поступлений.
          </p>
        </Panel>
        <Panel>
          <PanelTitle title="Документы и исключения" />
          <div className="fp-document-exception">
            <FileCheck2 size={19} />
            <div>
              <strong>Документ-основание</strong>
              <small>
                НПА, приказ, решение органа, договор или справка уполномоченного органа. Для полученной
                региональной поддержки и планируемой жилищной меры основание обязательно.
              </small>
            </div>
          </div>
          <div className="fp-document-exception">
            <CheckCircle2 size={19} />
            <div>
              <strong>Пенсии и социальные выплаты</strong>
              <small>Обязателен только ответ «Да / Нет». Документ не запрашивается.</small>
            </div>
          </div>
          <div className="fp-document-exception">
            <Info size={19} />
            <div>
              <strong>Единовременная выплата</strong>
              <small>
                Документ добавляется при наличии. Его отсутствие само по себе не блокирует отправку.
              </small>
            </div>
          </div>
          <p className="fp-instruction-note">
            Банковские выписки и справки по счетам не прикрепляются. Дата перечисления хранится отдельно от
            периода основания: позднее поступление само по себе не является противоречием.
          </p>
        </Panel>
        <Panel>
          <PanelTitle title="Раздельный учёт сведений" />
          <div className="fp-separation-row">
            <UsersRound size={19} />
            <div>
              <strong>Выплаты членам семьи</strong>
              <small>
                Получатель, связь с кандидатом, ФИО и год рождения. Это не личные поступления резервиста.
              </small>
            </div>
          </div>
          <div className="fp-separation-row">
            <Link2 size={19} />
            <div>
              <strong>Выплаты резервисту за родственника</strong>
              <small>
                Сохраняется связь с основанием. Для родственника — участника СВО нужны только ФИО, степень
                родства и предусмотренный анкетой статус.
              </small>
            </div>
          </div>
          <div className="fp-separation-row">
            <Home size={19} />
            <div>
              <strong>Планируемые и неденежные меры</strong>
              <small>
                Планируемое жильё, натуральная помощь и безвозмездная деятельность не прибавляются к денежным
                поступлениям.
              </small>
            </div>
          </div>
        </Panel>
      </div>
      <div className="fp-stack">
        <Panel className="fp-privacy-card">
          <LockKeyhole size={28} />
          <h2>Личный черновик доступен только резервисту</h2>
          <p>
            Уполномоченный специалист получает назначенный доступ только к отправленной версии. Самопроверка,
            история черновика и новые контакты до повторной отправки недоступны.
          </p>
          <div className="fp-privacy-line">
            <History size={18} />
            Новая версия не переписывает исходные сведения и комментарии
          </div>
        </Panel>
        <Panel>
          <PanelTitle title="Источники и ограничения" />
          <p>
            В макете нет подключения ведомственных источников, поиска банковских счетов и распознавания
            произвольных документов.
          </p>
          <div className="fp-divider" />
          <Notice tone="neutral">
            <strong>Сведения не получены</strong>
            <br />
            Отсутствие ответа источника не означает отсутствия дохода или выплаты.
          </Notice>
        </Panel>
        <Panel>
          <PanelTitle title="Рассмотрение и результат" />
          <p>
            Возможные несоответствия требуют сопоставления с основаниями и комментария специалиста. Завершение
            или снятие с рассмотрения фиксируется человеком с подтверждающим документом.
          </p>
          <p className="fp-instruction-note">
            Решение о назначении принимается вне платформы. Макет не заменяет «Справки БК» и официальную
            проверку.
          </p>
        </Panel>
        <Panel>
          <PanelTitle title="Работа с демонстрационным макетом" />
          <p>
            Все лица, контакты, реквизиты и суммы вымышлены. Данные хранятся только в памяти открытой
            страницы. Круговая стрелка повторяет самопроверку без перезагрузки и без потери вложений.
          </p>
          <p className="fp-instruction-note">
            В рабочем процессе личность подтверждает кадровая служба, она же выдаёт логин. Вход через
            Госуслуги в макете не реализован.
          </p>
        </Panel>
      </div>
    </div>
  )
}
