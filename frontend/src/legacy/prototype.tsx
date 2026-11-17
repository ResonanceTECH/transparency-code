import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  Database,
  FileCheck2,
  FileText,
  GraduationCap,
  HandCoins,
  History,
  Home,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
  X
} from 'lucide-react'
import './prototype.css'

type Role = 'reservist' | 'reviewer'
type Screen =
  | 'dashboard'
  | 'profile'
  | 'payments'
  | 'activities'
  | 'selfcheck'
  | 'messages'
  | 'queue'
  | 'case'
  | 'signals'

const reservistNav: Array<[Screen, string, ReactNode]> = [
  ['dashboard', 'Главная', <LayoutDashboard size={19} />],
  ['profile', 'Мой профиль', <UserRound size={19} />],
  ['payments', 'Выплаты и меры', <WalletCards size={19} />],
  ['activities', 'Деятельность', <BriefcaseBusiness size={19} />],
  ['selfcheck', 'Самопроверка', <ClipboardCheck size={19} />],
  ['messages', 'Уточнения', <MessageSquareText size={19} />]
]

const reviewerNav: Array<[Screen, string, ReactNode]> = [
  ['queue', 'Рабочая панель', <LayoutDashboard size={19} />],
  ['case', 'Карточка профиля', <UserRound size={19} />],
  ['signals', 'Сигналы проверки', <ListChecks size={19} />],
  ['messages', 'Запросы и ответы', <MessageSquareText size={19} />]
]

const titles: Record<Screen, [string, string]> = {
  dashboard: ['Добрый день, Алексей', 'Завершите финансовый профиль перед отправкой на проверку'],
  profile: ['Профиль резервиста', 'Личные сведения, программа и периоды службы'],
  payments: ['Выплаты и меры поддержки', 'Укажите сведения отдельно по каждой категории'],
  activities: ['Дополнительная деятельность', 'Родство, экспертная и преподавательская деятельность'],
  selfcheck: ['Самопроверка', 'Проверьте комплектность перед отправкой'],
  messages: ['Уточнения', 'Вопросы и ответы по представленным сведениям'],
  queue: ['Рабочая панель', 'Профили, назначенные вам для рассмотрения'],
  case: ['Карточка резервиста', 'Сводные сведения из представленной версии профиля'],
  signals: ['Сигналы проверки', 'Объяснимые результаты автоматического сопоставления']
}

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mp-card ${className}`}>{children}</section>
}

function Chip({
  children,
  tone = 'neutral'
}: {
  children: ReactNode
  tone?: 'neutral' | 'green' | 'amber' | 'blue' | 'red'
}) {
  return <span className={`mp-chip mp-chip-${tone}`}>{children}</span>
}

function Field({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <label className={`mp-field ${wide ? 'mp-wide' : ''}`}>
      <span>{label}</span>
      <div>{value}</div>
    </label>
  )
}

function CompletionRing({ value, size = 'large' }: { value: number; size?: 'large' | 'small' }) {
  return (
    <div
      className={`mp-ring mp-ring-${size}`}
      style={{ '--progress': `${value * 3.6}deg` } as React.CSSProperties}
    >
      <div>
        <strong>{value}%</strong>
        {size === 'large' && <span>заполнено</span>}
      </div>
    </div>
  )
}

function StepState({
  icon,
  title,
  note,
  state,
  onClick
}: {
  icon: ReactNode
  title: string
  note: string
  state: 'done' | 'current' | 'empty'
  onClick: () => void
}) {
  return (
    <button className={`mp-step-card mp-step-${state}`} onClick={onClick}>
      <span className="mp-step-icon">{state === 'done' ? <Check size={18} /> : icon}</span>
      <span>
        <strong>{title}</strong>
        <small>{note}</small>
      </span>
      <span className="mp-step-tail">
        {state === 'done' ? (
          <Chip tone="green">Готово</Chip>
        ) : state === 'current' ? (
          <Chip tone="amber">Продолжить</Chip>
        ) : (
          <ChevronRight size={18} />
        )}
      </span>
    </button>
  )
}

function StaticNotice({
  children,
  tone = 'blue'
}: {
  children: ReactNode
  tone?: 'blue' | 'amber' | 'green'
}) {
  return (
    <div className={`mp-notice mp-notice-${tone}`}>
      <CircleHelp size={18} />
      <div>{children}</div>
    </div>
  )
}

function PageHeader({ screen }: { screen: Screen }) {
  return (
    <div className="mp-page-header">
      <div>
        <div className="mp-breadcrumb">
          ФИНАНСОВЫЙ ПРОФИЛЬ <ChevronRight size={13} /> ДЕМО
        </div>
        <h1>{titles[screen][0]}</h1>
        <p>{titles[screen][1]}</p>
      </div>
      <div className="mp-page-actions">
        <button className="mp-button mp-button-ghost">
          <CircleHelp size={17} /> Помощь
        </button>
      </div>
    </div>
  )
}

function ReservistDashboard({ navigate }: { navigate: (screen: Screen) => void }) {
  return (
    <>
      <Card className="mp-profile-hero">
        <div className="mp-person-mark">АК</div>
        <div className="mp-profile-copy">
          <div>
            <Chip tone="amber">
              <Clock3 size={13} /> Черновик
            </Chip>
            <span className="mp-id">Профиль № РВ-2026-0147</span>
          </div>
          <h2>Ковалёв Алексей Сергеевич</h2>
          <p>Первый поток программы «Время героев» · Центральный федеральный округ</p>
          <div className="mp-profile-meta">
            <span>
              <Landmark size={16} /> Федеральный кадровый резерв
            </span>
            <span>
              <CalendarDays size={16} /> Обновлено сегодня, 10:42
            </span>
          </div>
        </div>
        <CompletionRing value={72} />
        <div className="mp-hero-action">
          <small>Следующий шаг</small>
          <strong>
            Заполните сведения
            <br />о мерах поддержки
          </strong>
          <button className="mp-button" onClick={() => navigate('payments')}>
            Продолжить <ArrowRight size={16} />
          </button>
        </div>
      </Card>

      <div className="mp-stat-grid">
        <Card className="mp-stat">
          <span className="mp-stat-icon mp-blue">
            <FileCheck2 />
          </span>
          <div>
            <strong>4 из 6</strong>
            <span>разделов заполнено</span>
          </div>
        </Card>
        <Card className="mp-stat">
          <span className="mp-stat-icon mp-green">
            <BadgeCheck />
          </span>
          <div>
            <strong>7</strong>
            <span>документов добавлено</span>
          </div>
        </Card>
        <Card className="mp-stat">
          <span className="mp-stat-icon mp-amber">
            <AlertCircle />
          </span>
          <div>
            <strong>2</strong>
            <span>пункта требуют внимания</span>
          </div>
        </Card>
      </div>

      <div className="mp-two-cols mp-dashboard-grid">
        <div>
          <div className="mp-section-title">
            <div>
              <h2>Разделы профиля</h2>
              <p>Заполните обязательные сведения последовательно</p>
            </div>
            <span>4 из 6 готово</span>
          </div>
          <div className="mp-step-list">
            <StepState
              icon={<UserRound size={18} />}
              title="Личные сведения и программа"
              note="Личность, поток и документ о включении в резерв"
              state="done"
              onClick={() => navigate('profile')}
            />
            <StepState
              icon={<Landmark size={18} />}
              title="Периоды службы"
              note="Военная и государственная служба"
              state="done"
              onClick={() => navigate('profile')}
            />
            <StepState
              icon={<UsersRound size={18} />}
              title="Сведения о родстве"
              note="Минимальные сведения и связь с выплатами"
              state="done"
              onClick={() => navigate('activities')}
            />
            <StepState
              icon={<HandCoins size={18} />}
              title="Выплаты и меры поддержки"
              note="Заполнено 8 из 10 категорий"
              state="current"
              onClick={() => navigate('payments')}
            />
            <StepState
              icon={<GraduationCap size={18} />}
              title="Экспертная деятельность"
              note="Преподавание, экспертиза и договоры"
              state="done"
              onClick={() => navigate('activities')}
            />
            <StepState
              icon={<ClipboardCheck size={18} />}
              title="Самопроверка и отправка"
              note="Станет доступно после заполнения"
              state="empty"
              onClick={() => navigate('selfcheck')}
            />
          </div>
        </div>
        <div className="mp-side-stack">
          <Card className="mp-next-card">
            <span className="mp-card-kicker">БЛИЖАЙШИЙ ШАГ</span>
            <div className="mp-next-date">
              <strong>12</strong>
              <span>
                НОЯ
                <br />
                2026
              </span>
            </div>
            <h3>Завершить заполнение профиля</h3>
            <p>До рекомендуемой даты отправки осталось 5 дней.</p>
            <div className="mp-progress">
              <span style={{ width: '72%' }} />
            </div>
            <small>Прогресс заполнения: 72%</small>
          </Card>
          <Card>
            <div className="mp-card-heading">
              <h3>Последние действия</h3>
              <button className="mp-icon-button">
                <MoreHorizontal size={19} />
              </button>
            </div>
            <div className="mp-timeline">
              <div>
                <i className="mp-dot-green" />
                <strong>Добавлен документ</strong>
                <p>Справка о денежном довольствии</p>
                <small>Сегодня, 10:42</small>
              </div>
              <div>
                <i />
                <strong>Заполнен период службы</strong>
                <p>01.06.2023 — 31.08.2025</p>
                <small>Вчера, 18:15</small>
              </div>
              <div>
                <i />
                <strong>Профиль создан</strong>
                <p>Начато заполнение сведений</p>
                <small>4 ноября, 12:08</small>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function ProfileScreen() {
  return (
    <div className="mp-two-cols mp-content-grid">
      <div className="mp-side-stack">
        <Card>
          <div className="mp-card-heading">
            <div>
              <span className="mp-card-kicker">РАЗДЕЛ 1</span>
              <h2>Основные сведения</h2>
            </div>
            <button className="mp-button mp-button-ghost">
              <Pencil size={15} /> Изменить
            </button>
          </div>
          <div className="mp-form-grid">
            <Field label="Фамилия, имя, отчество" value="Ковалёв Алексей Сергеевич" wide />
            <Field label="Год рождения" value="1987" />
            <Field label="Текущее место работы" value="Учебная организация № 17" />
            <Field label="Текущий статус" value="Находится в запасе" />
            <Field label="Направление назначения" value="Государственное управление" />
          </div>
        </Card>
        <Card>
          <div className="mp-card-heading">
            <div>
              <span className="mp-card-kicker">РАЗДЕЛ 2</span>
              <h2>Программа и кадровый резерв</h2>
            </div>
            <Chip tone="green">
              <CheckCircle2 size={13} /> Заполнено
            </Chip>
          </div>
          <div className="mp-form-grid">
            <Field label="Программа" value="Время героев" />
            <Field label="Поток / год" value="Первый поток · 2024" />
            <Field label="Регион" value="Центральный федеральный округ" />
            <Field label="Организатор" value="Учебная организация" />
            <Field label="Акт о включении в резерв" value="№ 147-Р от 14.09.2025" wide />
          </div>
          <div className="mp-file-row">
            <span>
              <FileText size={20} />
            </span>
            <div>
              <strong>Диплом_переподготовка.pdf</strong>
              <small>PDF · 1,8 МБ · добавлен 04.11.2026</small>
            </div>
            <Chip tone="green">Загружен</Chip>
          </div>
        </Card>
        <Card>
          <div className="mp-card-heading">
            <div>
              <span className="mp-card-kicker">РАЗДЕЛ 3</span>
              <h2>Периоды службы</h2>
            </div>
            <button className="mp-button mp-button-light">
              <Plus size={16} /> Добавить период
            </button>
          </div>
          <div className="mp-service-row">
            <span className="mp-service-icon">
              <ShieldCheck size={21} />
            </span>
            <div>
              <strong>Военная служба</strong>
              <p>Старший офицерский состав</p>
            </div>
            <div>
              <small>Период</small>
              <strong>01.06.2023 — 31.08.2025</strong>
            </div>
            <Chip tone="green">Подтверждено</Chip>
            <button className="mp-icon-button">
              <Pencil size={16} />
            </button>
          </div>
          <div className="mp-service-row">
            <span className="mp-service-icon mp-pale">
              <Building2 size={21} />
            </span>
            <div>
              <strong>Иное место работы</strong>
              <p>Экспертное подразделение</p>
            </div>
            <div>
              <small>Период</small>
              <strong>01.09.2025 — настоящее время</strong>
            </div>
            <Chip>Черновик</Chip>
            <button className="mp-icon-button">
              <Pencil size={16} />
            </button>
          </div>
        </Card>
      </div>
      <div className="mp-side-stack">
        <Card className="mp-mini-profile">
          <div className="mp-person-mark mp-large-mark">АК</div>
          <h3>Алексей Ковалёв</h3>
          <p>Вымышленный профиль</p>
          <CompletionRing value={72} size="small" />
          <div className="mp-divider" />
          <div className="mp-key-row">
            <span>Статус</span>
            <Chip tone="amber">Черновик</Chip>
          </div>
          <div className="mp-key-row">
            <span>Документов</span>
            <strong>7</strong>
          </div>
          <div className="mp-key-row">
            <span>Последнее изменение</span>
            <strong>Сегодня, 10:42</strong>
          </div>
        </Card>
        <StaticNotice>
          Сведения доступны проверяющему только после отправки профиля. Текущий черновик видите только вы.
        </StaticNotice>
        <Card>
          <div className="mp-card-heading">
            <h3>Контакт специалиста</h3>
            <MessageSquareText size={20} className="mp-muted-icon" />
          </div>
          <p>Если порядок заполнения непонятен, обратитесь к техническому помощнику.</p>
          <strong className="mp-contact">+7 (000) 000-00-00</strong>
          <a className="mp-link">profile@example.demo</a>
        </Card>
      </div>
    </div>
  )
}

const paymentRows = [
  {
    category: 'Денежное довольствие',
    recipient: 'Алексей Ковалёв',
    payer: 'Учебное ведомство',
    date: '31.08.2025',
    amount: '1 840 000 ₽',
    status: 'Подтверждено'
  },
  {
    category: 'Единовременная выплата',
    recipient: 'Алексей Ковалёв',
    payer: 'Учебное ведомство',
    date: '18.09.2025',
    amount: '450 000 ₽',
    status: 'Нужно уточнить'
  },
  {
    category: 'Региональная поддержка',
    recipient: 'Мария Ковалёва',
    payer: 'Учебный регион',
    date: '11.04.2025',
    amount: '120 000 ₽',
    status: 'Подтверждено'
  },
  {
    category: 'Жилищная мера',
    recipient: 'Алексей Ковалёв',
    payer: 'Уполномоченный орган',
    date: '02.10.2024',
    amount: 'Субсидия',
    status: 'Подтверждено'
  }
]

function PaymentsScreen({ navigate }: { navigate: (screen: Screen) => void }) {
  return (
    <>
      <div className="mp-summary-banner">
        <div>
          <span className="mp-summary-icon">
            <HandCoins size={25} />
          </span>
          <div>
            <small>ОТВЕТЫ ПО КАТЕГОРИЯМ</small>
            <strong>8 из 10 заполнено</strong>
            <p>Ответьте «получал / не получал» по каждой категории</p>
          </div>
        </div>
        <div className="mp-summary-progress">
          <strong>80%</strong>
          <div className="mp-progress">
            <span style={{ width: '80%' }} />
          </div>
        </div>
        <button className="mp-button">
          <Plus size={16} /> Добавить выплату
        </button>
      </div>
      <div className="mp-category-strip">
        {[
          ['Денежное довольствие', 'Получал', 'done'],
          ['Надбавки', 'Получал', 'done'],
          ['Единовременные', 'Получал', 'done'],
          ['Федеральная поддержка', 'Не получал', 'done'],
          ['Региональная поддержка', 'Получал', 'done'],
          ['Муниципальная', 'Не получал', 'done'],
          ['Членам семьи', 'Получал', 'done'],
          ['За родственника', 'Не получал', 'done'],
          ['Жилищные меры', 'Нет ответа', 'current'],
          ['Неденежные меры', 'Нет ответа', 'current']
        ].map(([title, answer, state], i) => (
          <button key={title} className={`mp-category ${state}`}>
            <span>{i + 1}</span>
            <strong>{title}</strong>
            <small>{answer}</small>
            {state === 'done' ? <Check size={15} /> : <AlertCircle size={15} />}
          </button>
        ))}
      </div>
      <Card className="mp-table-card">
        <div className="mp-table-toolbar">
          <div>
            <h2>Указанные выплаты</h2>
            <p>4 записи · данные демонстрационные</p>
          </div>
          <div className="mp-toolbar-actions">
            <label className="mp-search">
              <Search size={17} />
              <input placeholder="Поиск по выплатам" />
            </label>
            <button className="mp-button mp-button-ghost">
              <SlidersHorizontal size={16} /> Фильтры
            </button>
          </div>
        </div>
        <div className="mp-table-scroll">
          <table className="mp-table">
            <thead>
              <tr>
                <th>Категория</th>
                <th>Получатель</th>
                <th>Плательщик</th>
                <th>Дата получения</th>
                <th>Сумма / форма</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((row, i) => (
                <tr key={row.category}>
                  <td>
                    <div className="mp-table-title">
                      <span className="mp-row-icon">
                        <WalletCards size={17} />
                      </span>
                      <div>
                        <strong>{row.category}</strong>
                        <small>Запись ВП-{String(i + 1).padStart(3, '0')}</small>
                      </div>
                    </div>
                  </td>
                  <td>{row.recipient}</td>
                  <td>{row.payer}</td>
                  <td>{row.date}</td>
                  <td>
                    <strong>{row.amount}</strong>
                  </td>
                  <td>
                    <Chip tone={row.status === 'Подтверждено' ? 'green' : 'amber'}>{row.status}</Chip>
                  </td>
                  <td>
                    <button className="mp-icon-button">
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mp-bottom-action">
        <div>
          <AlertCircle size={19} />
          <span>
            <strong>Осталось заполнить 2 категории</strong>
            <small>После этого станет доступна итоговая самопроверка</small>
          </span>
        </div>
        <button className="mp-button" onClick={() => navigate('selfcheck')}>
          Перейти к самопроверке <ArrowRight size={16} />
        </button>
      </div>
    </>
  )
}

function ActivitiesScreen() {
  return (
    <div className="mp-two-cols mp-content-grid">
      <div className="mp-side-stack">
        <Card>
          <div className="mp-card-heading">
            <div>
              <span className="mp-card-kicker">СВЯЗАННЫЕ СВЕДЕНИЯ</span>
              <h2>Родство с участником СВО</h2>
            </div>
            <Chip tone="green">
              <Check size={13} /> Заполнено
            </Chip>
          </div>
          <div className="mp-question">
            <span>Являетесь ли вы родственником участника СВО?</span>
            <div className="mp-segment">
              <button className="active">Да</button>
              <button>Нет</button>
            </div>
          </div>
          <div className="mp-form-grid">
            <Field label="Фамилия, имя, отчество" value="Ковалёв Сергей Петрович" />
            <Field label="Степень родства" value="Родитель" />
            <Field label="Статус родственника" value="Участвовал" />
            <Field label="Получали выплаты в связи с родством?" value="Нет" />
          </div>
          <StaticNotice>
            В профиль включены только минимальные сведения, необходимые для связи получателя с основанием
            выплаты.
          </StaticNotice>
        </Card>
        <Card>
          <div className="mp-card-heading">
            <div>
              <span className="mp-card-kicker">ДОПОЛНИТЕЛЬНАЯ ДЕЯТЕЛЬНОСТЬ</span>
              <h2>Экспертная и преподавательская работа</h2>
            </div>
            <button className="mp-button mp-button-light">
              <Plus size={16} /> Добавить
            </button>
          </div>
          <div className="mp-activity-card">
            <span className="mp-activity-icon">
              <GraduationCap size={23} />
            </span>
            <div className="mp-activity-main">
              <div>
                <strong>Преподавательская деятельность</strong>
                <Chip tone="amber">Проверить период</Chip>
              </div>
              <p>Учебный университет · совместительство</p>
              <span>
                <CalendarDays size={15} /> 01.09.2025 — 30.06.2026
              </span>
            </div>
            <div className="mp-activity-doc">
              <small>Документ-основание</small>
              <strong>Договор № 18/25</strong>
              <span>
                <Paperclip size={14} /> contract_demo.pdf
              </span>
            </div>
            <button className="mp-icon-button">
              <Pencil size={16} />
            </button>
          </div>
          <div className="mp-activity-card">
            <span className="mp-activity-icon mp-pale">
              <BookOpen size={23} />
            </span>
            <div className="mp-activity-main">
              <div>
                <strong>Участие в экспертной комиссии</strong>
                <Chip tone="green">Без пересечений</Chip>
              </div>
              <p>Учебный экспертный центр · безвозмездно</p>
              <span>
                <CalendarDays size={15} /> 12.02.2026 — 18.02.2026
              </span>
            </div>
            <div className="mp-activity-doc">
              <small>Документ-основание</small>
              <strong>Приказ № 24-Э</strong>
              <span>
                <Paperclip size={14} /> order_demo.pdf
              </span>
            </div>
            <button className="mp-icon-button">
              <Pencil size={16} />
            </button>
          </div>
        </Card>
      </div>
      <div className="mp-side-stack">
        <Card className="mp-explain-card">
          <span className="mp-explain-icon">
            <Sparkles size={22} />
          </span>
          <h3>Что проверит система</h3>
          <ul>
            <li>
              <Check size={15} /> Заполнены ли обязательные поля
            </li>
            <li>
              <Check size={15} /> Указан ли документ-основание
            </li>
            <li>
              <Check size={15} /> Пересекаются ли периоды со службой
            </li>
            <li>
              <Check size={15} /> Связаны ли выплаты с нужным получателем
            </li>
          </ul>
          <p>Совпадение периодов не является выводом о нарушении и требует оценки специалиста.</p>
        </Card>
        <Card>
          <div className="mp-card-heading">
            <h3>Документы раздела</h3>
            <strong>2</strong>
          </div>
          <div className="mp-mini-file">
            <FileText size={18} />
            <span>
              <strong>contract_demo.pdf</strong>
              <small>Договор · 640 КБ</small>
            </span>
            <CheckCircle2 size={17} />
          </div>
          <div className="mp-mini-file">
            <FileText size={18} />
            <span>
              <strong>order_demo.pdf</strong>
              <small>Приказ · 420 КБ</small>
            </span>
            <CheckCircle2 size={17} />
          </div>
        </Card>
      </div>
    </div>
  )
}

function SelfCheckScreen() {
  const checks = [
    ['Личные сведения', 'Обязательные поля заполнены', 'ok'],
    ['Периоды службы', 'Указаны даты и виды службы', 'ok'],
    ['Категории выплат', 'Нет ответа по двум категориям', 'warn'],
    ['Подтверждающие документы', 'У одной выплаты отсутствует документ', 'warn'],
    ['Получатели выплат', 'Связи с получателями заполнены', 'ok'],
    ['Дополнительная деятельность', 'Периоды и основания указаны', 'ok']
  ]
  return (
    <div className="mp-two-cols mp-review-grid">
      <div className="mp-side-stack">
        <Card className="mp-check-hero">
          <span className="mp-check-big">
            <ClipboardCheck size={32} />
          </span>
          <div>
            <Chip tone="amber">Профиль пока не готов к отправке</Chip>
            <h2>Нужно исправить 2 пункта</h2>
            <p>
              Система проверила заполненность и внутреннюю согласованность сведений. Это не юридическая
              проверка.
            </p>
          </div>
          <div className="mp-check-score">
            <strong>8/10</strong>
            <span>проверок пройдено</span>
          </div>
        </Card>
        <Card>
          <div className="mp-card-heading">
            <div>
              <h2>Результаты самопроверки</h2>
              <p>Проверено несколько минут назад</p>
            </div>
            <button className="mp-button mp-button-ghost">
              <Activity size={16} /> Проверить снова
            </button>
          </div>
          <div className="mp-check-list">
            {checks.map(([title, note, state]) => (
              <div key={title} className={`mp-check-row ${state}`}>
                <span>{state === 'ok' ? <Check size={18} /> : <AlertCircle size={18} />}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{note}</small>
                </div>
                {state === 'ok' ? (
                  <Chip tone="green">Готово</Chip>
                ) : (
                  <button className="mp-link-button">
                    Исправить <ChevronRight size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="mp-side-stack">
        <Card>
          <span className="mp-card-kicker">ПЕРЕД ОТПРАВКОЙ</span>
          <h2>Состав профиля</h2>
          <div className="mp-key-row">
            <span>Разделов</span>
            <strong>6</strong>
          </div>
          <div className="mp-key-row">
            <span>Записей о выплатах</span>
            <strong>4</strong>
          </div>
          <div className="mp-key-row">
            <span>Документов</span>
            <strong>7</strong>
          </div>
          <div className="mp-key-row">
            <span>Версия</span>
            <strong>Черновик № 3</strong>
          </div>
          <div className="mp-divider" />
          <label className="mp-consent">
            <input type="checkbox" />
            <span>Подтверждаю, что проверил представленные сведения</span>
          </label>
          <button className="mp-button mp-full" disabled>
            <Send size={16} /> Отправить на проверку
          </button>
          <small className="mp-center-note">
            Кнопка станет доступна после устранения обязательных замечаний
          </small>
        </Card>
        <StaticNotice tone="amber">
          <strong>После отправки версия будет зафиксирована.</strong>
          <br />
          Проверяющий не увидит историю ваших черновиков и подсказки самопроверки.
        </StaticNotice>
      </div>
    </div>
  )
}

const queueRows = [
  [
    'РВ-2026-0147',
    'Ковалёв Алексей Сергеевич',
    'Время героев · поток 1',
    'Сегодня, 09:24',
    '3 сигнала',
    'Новый'
  ],
  [
    'РВ-2026-0139',
    'Волкова Ирина Михайловна',
    'Время героев · поток 1',
    'Вчера, 16:10',
    '1 сигнал',
    'В работе'
  ],
  ['РВ-2026-0128', 'Орлов Денис Андреевич', 'Федеральный резерв', '05.11.2026', 'Нет сигналов', 'В работе'],
  [
    'РВ-2026-0114',
    'Соколова Елена Викторовна',
    'Время героев · поток 2',
    '03.11.2026',
    '2 уточнения',
    'Уточнение'
  ]
]

function QueueScreen({ navigate }: { navigate: (screen: Screen) => void }) {
  return (
    <>
      <div className="mp-stat-grid mp-reviewer-stats">
        <Card className="mp-stat">
          <span className="mp-stat-icon mp-blue">
            <Inbox />
          </span>
          <div>
            <strong>12</strong>
            <span>назначено вам</span>
          </div>
          <small>+3 за неделю</small>
        </Card>
        <Card className="mp-stat">
          <span className="mp-stat-icon mp-amber">
            <AlertCircle />
          </span>
          <div>
            <strong>5</strong>
            <span>требуют внимания</span>
          </div>
          <small>Есть сигналы</small>
        </Card>
        <Card className="mp-stat">
          <span className="mp-stat-icon mp-green">
            <CheckCircle2 />
          </span>
          <div>
            <strong>18</strong>
            <span>завершено</span>
          </div>
          <small>За текущий месяц</small>
        </Card>
        <Card className="mp-stat">
          <span className="mp-stat-icon mp-violet">
            <Clock3 />
          </span>
          <div>
            <strong>2,4 дня</strong>
            <span>средний срок</span>
          </div>
          <small>Учебная метрика</small>
        </Card>
      </div>
      <Card className="mp-table-card">
        <div className="mp-table-toolbar">
          <div>
            <h2>Поступило на проверку</h2>
            <p>Назначенные вам профили резервистов</p>
          </div>
          <div className="mp-toolbar-actions">
            <label className="mp-search">
              <Search size={17} />
              <input placeholder="ФИО или номер профиля" />
            </label>
            <button className="mp-button mp-button-ghost">
              <SlidersHorizontal size={16} /> Фильтры
            </button>
          </div>
        </div>
        <div className="mp-queue-tabs">
          <button className="active">
            Все <span>12</span>
          </button>
          <button>
            Новые <span>3</span>
          </button>
          <button>
            В работе <span>5</span>
          </button>
          <button>
            На уточнении <span>2</span>
          </button>
          <button>
            Завершённые <span>18</span>
          </button>
        </div>
        <div className="mp-table-scroll">
          <table className="mp-table mp-queue-table">
            <thead>
              <tr>
                <th>Профиль</th>
                <th>Резервист</th>
                <th>Программа</th>
                <th>Представлено</th>
                <th>Результат анализа</th>
                <th>Статус</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {queueRows.map((row, i) => (
                <tr
                  key={row[0]}
                  onClick={() => i === 0 && navigate('case')}
                  className={i === 0 ? 'clickable' : ''}
                >
                  <td>
                    <strong>{row[0]}</strong>
                    <small>Версия 1</small>
                  </td>
                  <td>
                    <div className="mp-table-person">
                      <span>
                        {row[1]
                          .split(' ')
                          .slice(0, 2)
                          .map((v) => v[0])
                          .join('')}
                      </span>
                      <div>
                        <strong>{row[1]}</strong>
                        <small>Вымышленные сведения</small>
                      </div>
                    </div>
                  </td>
                  <td>{row[2]}</td>
                  <td>{row[3]}</td>
                  <td>
                    <Chip
                      tone={
                        row[4] === 'Нет сигналов' ? 'green' : row[4].includes('уточнения') ? 'blue' : 'amber'
                      }
                    >
                      {row[4]}
                    </Chip>
                  </td>
                  <td>
                    <Chip tone={row[5] === 'Новый' ? 'blue' : row[5] === 'Уточнение' ? 'amber' : 'neutral'}>
                      {row[5]}
                    </Chip>
                  </td>
                  <td>
                    <button className="mp-icon-button" onClick={() => navigate('case')}>
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mp-pagination">
          <span>Показано 4 из 12</span>
          <div>
            <button className="mp-icon-button" disabled>
              <ArrowLeft size={16} />
            </button>
            <button className="mp-page-number active">1</button>
            <button className="mp-page-number">2</button>
            <button className="mp-page-number">3</button>
            <button className="mp-icon-button">
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </Card>
    </>
  )
}

function ReviewCaseScreen({ navigate }: { navigate: (screen: Screen) => void }) {
  return (
    <>
      <button className="mp-back-link" onClick={() => navigate('queue')}>
        <ArrowLeft size={16} /> Вернуться к очереди
      </button>
      <Card className="mp-review-person">
        <div className="mp-person-mark mp-large-mark">АК</div>
        <div className="mp-review-person-copy">
          <div>
            <Chip tone="blue">Принят к рассмотрению</Chip>
            <span>РВ-2026-0147 · версия 1</span>
          </div>
          <h2>Ковалёв Алексей Сергеевич</h2>
          <p>Первый поток программы «Время героев» · профиль представлен 07.11.2026 в 09:24</p>
        </div>
        <div className="mp-review-person-stats">
          <div>
            <small>Комплектность</small>
            <strong>100%</strong>
          </div>
          <div>
            <small>Автосигналы</small>
            <strong className="mp-amber-text">3</strong>
          </div>
          <div>
            <small>Документы</small>
            <strong>7</strong>
          </div>
        </div>
        <button className="mp-button" onClick={() => navigate('signals')}>
          Открыть сигналы <ArrowRight size={16} />
        </button>
      </Card>
      <div className="mp-case-tabs">
        <button className="active">Обзор</button>
        <button>
          Выплаты <span>4</span>
        </button>
        <button>
          Деятельность <span>2</span>
        </button>
        <button>
          Документы <span>7</span>
        </button>
        <button onClick={() => navigate('signals')}>
          Сигналы <span className="warn">3</span>
        </button>
        <button>История</button>
      </div>
      <div className="mp-two-cols mp-case-grid">
        <div className="mp-side-stack">
          <Card>
            <div className="mp-card-heading">
              <div>
                <span className="mp-card-kicker">СВОДНЫЕ СВЕДЕНИЯ</span>
                <h2>Профиль резервиста</h2>
              </div>
              <Chip tone="green">
                <CheckCircle2 size={13} /> Комплект полный
              </Chip>
            </div>
            <div className="mp-review-facts">
              <div>
                <small>Текущий статус</small>
                <strong>Находится в запасе</strong>
              </div>
              <div>
                <small>Предполагаемое направление</small>
                <strong>Государственное управление</strong>
              </div>
              <div>
                <small>Период службы</small>
                <strong>01.06.2023 — 31.08.2025</strong>
              </div>
              <div>
                <small>Категория состава</small>
                <strong>Старший офицерский состав</strong>
              </div>
              <div>
                <small>Родство с участником СВО</small>
                <strong>Да · родитель</strong>
              </div>
              <div>
                <small>Связанные выплаты</small>
                <strong>Не получал</strong>
              </div>
            </div>
          </Card>
          <Card>
            <div className="mp-card-heading">
              <div>
                <span className="mp-card-kicker">ФИНАНСОВАЯ СВОДКА</span>
                <h2>Заявленные сведения</h2>
              </div>
              <span className="mp-caption">Без неденежных мер</span>
            </div>
            <div className="mp-finance-bars">
              <div>
                <span>Денежное довольствие</span>
                <div>
                  <i style={{ width: '78%' }} />
                </div>
                <strong>1 840 000 ₽</strong>
              </div>
              <div>
                <span>Единовременные выплаты</span>
                <div>
                  <i style={{ width: '32%' }} />
                </div>
                <strong>450 000 ₽</strong>
              </div>
              <div>
                <span>Выплаты членам семьи</span>
                <div>
                  <i style={{ width: '18%' }} />
                </div>
                <strong>120 000 ₽</strong>
              </div>
            </div>
            <div className="mp-key-row mp-total">
              <span>Итого денежных поступлений в профиле</span>
              <strong>2 410 000 ₽</strong>
            </div>
            <small>Сумма является сводкой представленных записей, а не подтверждённым доходом.</small>
          </Card>
        </div>
        <div className="mp-side-stack">
          <Card className="mp-attention-card">
            <div className="mp-card-heading">
              <div>
                <span className="mp-card-kicker">АВТОМАТИЧЕСКОЕ СОПОСТАВЛЕНИЕ</span>
                <h2>Требует внимания</h2>
              </div>
              <span className="mp-signal-number">3</span>
            </div>
            <div className="mp-mini-signal">
              <span>
                <CalendarDays size={18} />
              </span>
              <div>
                <strong>Дата выплаты после периода службы</strong>
                <p>Нужно проверить основание выплаты</p>
              </div>
              <ChevronRight size={17} />
            </div>
            <div className="mp-mini-signal">
              <span>
                <UsersRound size={18} />
              </span>
              <div>
                <strong>Получатель отличается от резервиста</strong>
                <p>Проверить связь с членом семьи</p>
              </div>
              <ChevronRight size={17} />
            </div>
            <div className="mp-mini-signal">
              <span>
                <CopyIcon />
              </span>
              <div>
                <strong>Возможный повторный учёт</strong>
                <p>Две записи имеют общие признаки</p>
              </div>
              <ChevronRight size={17} />
            </div>
            <button className="mp-button mp-full" onClick={() => navigate('signals')}>
              Рассмотреть все сигналы
            </button>
          </Card>
          <Card>
            <div className="mp-card-heading">
              <h3>Действия по материалу</h3>
              <MoreHorizontal size={19} />
            </div>
            <button className="mp-button mp-button-light mp-full">
              <MessageSquareText size={16} /> Запросить уточнение
            </button>
            <button className="mp-button mp-button-ghost mp-full">
              <CheckCircle2 size={16} /> Завершить рассмотрение
            </button>
            <small className="mp-center-note">Для изменения статуса необходимо указать комментарий</small>
          </Card>
        </div>
      </div>
    </>
  )
}

function CopyIcon() {
  return <Database size={18} />
}

const signals = [
  {
    code: 'СВ-02',
    title: 'Дата выплаты не входит в период службы',
    type: 'Периоды',
    text: 'Единовременная выплата получена после завершения указанного периода службы.',
    tone: 'amber' as const
  },
  {
    code: 'ПЛ-03',
    title: 'Получатель выплаты — член семьи',
    type: 'Получатель',
    text: 'Региональная выплата связана с Марией Ковалёвой и должна учитываться отдельно.',
    tone: 'blue' as const
  },
  {
    code: 'ДУ-01',
    title: 'Возможный повторный учёт выплаты',
    type: 'Дубли',
    text: 'У двух записей совпадают сумма, плательщик и близкие даты получения.',
    tone: 'amber' as const
  }
]

function SignalsScreen({ navigate }: { navigate: (screen: Screen) => void }) {
  const [selected, setSelected] = useState(0)
  return (
    <>
      <button className="mp-back-link" onClick={() => navigate('case')}>
        <ArrowLeft size={16} /> К карточке резервиста
      </button>
      <div className="mp-signal-top">
        <div>
          <span className="mp-person-tiny">АК</span>
          <div>
            <strong>Ковалёв Алексей Сергеевич</strong>
            <small>РВ-2026-0147 · представленная версия 1</small>
          </div>
        </div>
        <div>
          <Chip tone="amber">3 сигнала не рассмотрено</Chip>
          <span className="mp-caption">Правила версии 0.1</span>
        </div>
      </div>
      <div className="mp-signal-layout">
        <div>
          <div className="mp-signal-filters">
            <button className="active">
              Все <span>3</span>
            </button>
            <button>
              Периоды <span>1</span>
            </button>
            <button>
              Получатели <span>1</span>
            </button>
            <button>
              Дубли <span>1</span>
            </button>
          </div>
          <div className="mp-signal-list">
            {signals.map((signal, i) => (
              <button
                key={signal.code}
                className={`mp-signal-item ${selected === i ? 'active' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className={`mp-signal-symbol mp-${signal.tone}`}>
                  <AlertCircle size={19} />
                </span>
                <div>
                  <span className="mp-card-kicker">
                    {signal.code} · {signal.type}
                  </span>
                  <h3>{signal.title}</h3>
                  <p>{signal.text}</p>
                  <div>
                    <Chip tone={signal.tone}>Не рассмотрено</Chip>
                    <span>2 записи-основания</span>
                  </div>
                </div>
                <ChevronRight size={19} />
              </button>
            ))}
          </div>
        </div>
        <Card className="mp-signal-detail">
          <div className="mp-detail-head">
            <span className={`mp-signal-symbol mp-${signals[selected].tone}`}>
              <AlertCircle size={21} />
            </span>
            <div>
              <span className="mp-card-kicker">{signals[selected].code} · ДЕТЕРМИНИРОВАННОЕ ПРАВИЛО</span>
              <h2>{signals[selected].title}</h2>
            </div>
            <button className="mp-icon-button">
              <X size={18} />
            </button>
          </div>
          <p className="mp-detail-lead">
            {signals[selected].text} Сигнал указывает только на необходимость сопоставить сведения и не
            является выводом о нарушении.
          </p>
          <h3 className="mp-subheading">Сопоставленные сведения</h3>
          <div className="mp-compare">
            <article>
              <span className="mp-compare-label">ПЕРИОД СЛУЖБЫ</span>
              <div>
                <ShieldCheck size={18} />
                <strong>Военная служба</strong>
              </div>
              <dl>
                <dt>Начало</dt>
                <dd>01.06.2023</dd>
                <dt>Окончание</dt>
                <dd>31.08.2025</dd>
                <dt>Источник</dt>
                <dd>Профиль резервиста</dd>
              </dl>
            </article>
            <span className="mp-compare-arrow">
              <ArrowRight size={18} />
            </span>
            <article className="highlight">
              <span className="mp-compare-label">ВЫПЛАТА</span>
              <div>
                <HandCoins size={18} />
                <strong>Единовременная выплата</strong>
              </div>
              <dl>
                <dt>Дата получения</dt>
                <dd>18.09.2025</dd>
                <dt>Сумма</dt>
                <dd>450 000 ₽</dd>
                <dt>Основание</dt>
                <dd>Приказ № Д-118</dd>
              </dl>
            </article>
          </div>
          <StaticNotice tone="amber">
            <strong>Что рекомендуется уточнить</strong>
            <br />
            Проверить, относится ли выплата к указанному периоду службы и допускает ли основание перечисление
            после его окончания.
          </StaticNotice>
          <h3 className="mp-subheading">Решение проверяющего</h3>
          <label className="mp-textarea">
            <span>Комментарий</span>
            <textarea placeholder="Укажите проверенные сведения и основание решения…" rows={3} />
          </label>
          <div className="mp-detail-actions">
            <button className="mp-button mp-button-light">
              <MessageSquareText size={16} /> Запросить уточнение
            </button>
            <button className="mp-button">
              <CheckCircle2 size={16} /> Сигнал рассмотрен
            </button>
          </div>
        </Card>
      </div>
    </>
  )
}

function MessagesScreen({ role }: { role: Role }) {
  return (
    <div className="mp-message-layout">
      <Card className="mp-thread-list">
        <div className="mp-card-heading">
          <h2>Переписка</h2>
          <Chip tone="blue">1 новый</Chip>
        </div>
        <button className="mp-thread active">
          <span className="mp-person-tiny">{role === 'reservist' ? 'КС' : 'АК'}</span>
          <div>
            <strong>{role === 'reservist' ? 'Кадровый специалист' : 'Алексей Ковалёв'}</strong>
            <p>Уточните основание единовременной...</p>
            <small>Сегодня, 11:08</small>
          </div>
        </button>
        <button className="mp-thread">
          <span className="mp-person-tiny mp-gray">ТП</span>
          <div>
            <strong>Техническая поддержка</strong>
            <p>Ваш документ успешно добавлен</p>
            <small>Вчера</small>
          </div>
        </button>
      </Card>
      <Card className="mp-chat">
        <div className="mp-chat-head">
          <span className="mp-person-tiny">{role === 'reservist' ? 'КС' : 'АК'}</span>
          <div>
            <strong>{role === 'reservist' ? 'Кадровый специалист' : 'Алексей Ковалёв'}</strong>
            <small>По профилю РВ-2026-0147</small>
          </div>
          <Chip tone="amber">Требуется уточнение</Chip>
        </div>
        <div className="mp-chat-body">
          <div className="mp-chat-date">7 ноября 2026</div>
          <div className="mp-bubble other">
            Пожалуйста, уточните, к какому периоду службы относится единовременная выплата от 18.09.2025, и
            приложите документ-основание.<small>11:08</small>
          </div>
          <div className="mp-bubble own">
            Выплата относится к периоду службы до 31.08.2025. Добавлю приказ в профиль.<small>11:26</small>
          </div>
        </div>
        <div className="mp-chat-input">
          <button className="mp-icon-button">
            <Paperclip size={18} />
          </button>
          <input placeholder="Написать сообщение…" />
          <button className="mp-button">
            <Send size={17} />
          </button>
        </div>
      </Card>
    </div>
  )
}

export default function Prototype() {
  const [role, setRole] = useState<Role>('reservist')
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [mobileNav, setMobileNav] = useState(false)

  useEffect(() => {
    document.title = 'Резонанс · Макет финансового профиля'
    document.body.classList.add('mp-body')
    return () => document.body.classList.remove('mp-body')
  }, [])

  const switchRole = (next: Role) => {
    setRole(next)
    setScreen(next === 'reservist' ? 'dashboard' : 'queue')
    setMobileNav(false)
  }
  const navigate = (next: Screen) => {
    setScreen(next)
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const nav = role === 'reservist' ? reservistNav : reviewerNav

  return (
    <div className="mp-shell">
      <aside className={`mp-sidebar ${mobileNav ? 'open' : ''}`}>
        <button className="mp-mobile-close" onClick={() => setMobileNav(false)}>
          <X />
        </button>
        <div className="mp-brand">
          <span>
            <ShieldCheck size={23} />
          </span>
          <div>
            <strong>РЕЗОНАНС</strong>
            <small>Финансовый профиль</small>
          </div>
        </div>
        <div className="mp-demo-label">
          <i /> ДЕМОНСТРАЦИОННЫЙ МАКЕТ
        </div>
        <div className="mp-nav-caption">
          {role === 'reservist' ? 'ЛИЧНЫЙ КАБИНЕТ' : 'РАБОЧЕЕ ПРОСТРАНСТВО'}
        </div>
        <nav className="mp-nav">
          {nav.map(([key, label, icon]) => (
            <button key={key} className={screen === key ? 'active' : ''} onClick={() => navigate(key)}>
              {icon}
              <span>{label}</span>
              {key === 'messages' && <em>1</em>}
            </button>
          ))}
        </nav>
        <div className="mp-sidebar-bottom">
          <div className="mp-support">
            <CircleHelp size={19} />
            <div>
              <strong>Нужна помощь?</strong>
              <small>Инструкция по заполнению</small>
            </div>
            <ChevronRight size={16} />
          </div>
          <button className="mp-logout">
            <LogOut size={18} /> Выйти
          </button>
          <div className="mp-version">Макет интерфейса · 07.11.2026</div>
        </div>
      </aside>
      {mobileNav && (
        <button className="mp-overlay" onClick={() => setMobileNav(false)} aria-label="Закрыть меню" />
      )}
      <div className="mp-workspace">
        <header className="mp-topbar">
          <button className="mp-menu-button" onClick={() => setMobileNav(true)}>
            <Menu size={21} />
          </button>
          <div className="mp-role-switch">
            <button className={role === 'reservist' ? 'active' : ''} onClick={() => switchRole('reservist')}>
              <UserRound size={16} /> Резервист
            </button>
            <button className={role === 'reviewer' ? 'active' : ''} onClick={() => switchRole('reviewer')}>
              <ShieldCheck size={16} /> Проверяющий
            </button>
          </div>
          <div className="mp-topbar-right">
            <span className="mp-synthetic">
              <Database size={14} /> Синтетические данные
            </span>
            <button className="mp-bell">
              <Bell size={19} />
              <i />
            </button>
            <div className="mp-user-mini">
              <span>{role === 'reservist' ? 'АК' : 'КС'}</span>
              <div>
                <strong>{role === 'reservist' ? 'Алексей Ковалёв' : 'Кадровый специалист'}</strong>
                <small>{role === 'reservist' ? 'Резервист · демо' : 'Проверяющий · демо'}</small>
              </div>
              <ChevronDown size={15} />
            </div>
          </div>
        </header>
        <main className="mp-main">
          <PageHeader screen={screen} />
          {screen === 'dashboard' && <ReservistDashboard navigate={navigate} />}
          {screen === 'profile' && <ProfileScreen />}
          {screen === 'payments' && <PaymentsScreen navigate={navigate} />}
          {screen === 'activities' && <ActivitiesScreen />}
          {screen === 'selfcheck' && <SelfCheckScreen />}
          {screen === 'queue' && <QueueScreen navigate={navigate} />}
          {screen === 'case' && <ReviewCaseScreen navigate={navigate} />}
          {screen === 'signals' && <SignalsScreen navigate={navigate} />}
          {screen === 'messages' && <MessagesScreen role={role} />}
          <footer className="mp-footer">
            <span>Команда «Резонанс» · направление № 6</span>
            <span>Макет на вымышленных данных · решения принимает уполномоченный специалист</span>
          </footer>
        </main>
      </div>
    </div>
  )
}
