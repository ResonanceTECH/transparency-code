import {
  BadgeCheck,
  BookOpen,
  Building2,
  ClipboardCheck,
  FileCheck2,
  FolderOpen,
  GraduationCap,
  HandCoins,
  History,
  Home,
  Inbox,
  Landmark,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  Printer,
  ShieldCheck,
  UserRound,
  UsersRound,
  WalletCards
} from 'lucide-react'
import type { NavItem, Screen, ProfileContent } from './types'
import samples from 'virtual:resonance-profile-sample'

export const profileId = samples.profile_id
// Сценарий не является начальным состоянием аккаунта: он импортируется явно через API.
export function createEmptyContent(): ProfileContent {
  return {
    candidate: { fullName: '', birthYear: '', workplace: '', workStatus: '', phone: '', email: '', reportingPeriod: '',
      region: '', flow: '', programYear: '', regionalProgram: '', regionalProgramYear: '', appointmentAuthority: '',
      organizer: '', diplomaDetails: '', reserveActDetails: '', diplomaDocumentId: '', reserveActDocumentId: '' },
    servicePeriods: [], relativeAnswer: '', kinship: { fullName: '', degree: '', status: '', receivedPayments: '' },
    familyRecipients: [], categoryAnswers: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, ''])),
    supportLevels: { 'Федеральный': '', 'Региональный': '', 'Муниципальный': '' }, personalInsuranceAnswer: '',
    records: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i, []])), activityAnswer: '', activities: [],
    attachments: [], consentDocumentId: '', photo: null, legacyData: {}
  }
}
export function createInitialContent(): ProfileContent {
  const content = structuredClone(samples.profile) as ProfileContent
  content.attachments = content.attachments.map((file) => ({
    ...file, url: `/samples/${encodeURIComponent(file.name)}`
  }))
  return content
}
export const responsibleContacts = [
  {
    name: 'Иванов Иван Иванович',
    responsibility: 'Заполнение профиля',
    phone: '+7 (000) 000-00-01',
    email: 'ivanov@resonance.example'
  },
  {
    name: 'Петров Петр Сергеевич',
    responsibility: 'Технические вопросы',
    phone: '+7 (000) 000-00-02',
    email: 'petrov@resonance.example'
  }
]
export const profileStages = [
  [10, 'Личные сведения'],
  [30, 'Программа и резерв'],
  [50, 'Служба и родство'],
  [70, 'Ответы по выплатам'],
  [90, 'Записи и деятельность']
] as const
export const reservistNav: NavItem[] = [
  { screen: 'home', title: 'Главная', icon: <LayoutDashboard size={19} /> },
  { screen: 'profile', title: 'Профиль и служба', icon: <UserRound size={19} /> },
  { screen: 'kinship', title: 'Родство и получатели', icon: <UsersRound size={19} /> },
  { screen: 'payments', title: 'Выплаты и меры', icon: <WalletCards size={19} /> },
  { screen: 'activities', title: 'Деятельность', icon: <GraduationCap size={19} /> },
  { screen: 'documents', title: 'Документы', icon: <FolderOpen size={19} /> },
  { screen: 'selfcheck', title: 'Самопроверка', icon: <ClipboardCheck size={19} /> },
  { screen: 'messages', title: 'Уточнения', icon: <MessageSquareText size={19} /> },
  { screen: 'history', title: 'Версии и журнал', icon: <History size={19} /> },
  { screen: 'print', title: 'Печать анкеты', icon: <Printer size={19} /> },
  { screen: 'templates', title: 'Шаблоны и памятки', icon: <BookOpen size={19} /> }
]
export const reviewerNav: NavItem[] = [
  { screen: 'queue', title: 'Поступило на проверку', icon: <Inbox size={19} /> },
  { screen: 'case', title: 'Карточка кандидата в резерв', icon: <UserRound size={19} /> },
  { screen: 'documents', title: 'Документы и качество', icon: <FolderOpen size={19} /> },
  { screen: 'signals', title: 'Карточка сигналов', icon: <ListChecks size={19} /> },
  { screen: 'messages', title: 'Запросы уточнений', icon: <MessageSquareText size={19} /> },
  { screen: 'result', title: 'Результат рассмотрения', icon: <FileCheck2 size={19} /> },
  { screen: 'history', title: 'Версии и журнал', icon: <History size={19} /> },
  { screen: 'print', title: 'Печать анкеты', icon: <Printer size={19} /> },
  { screen: 'templates', title: 'Шаблоны и памятки', icon: <BookOpen size={19} /> }
]
export const headings: Record<Screen, [string, string]> = {
  home: ['Финансовый профиль', ''],
  profile: [
    'Профиль и периоды службы',
    'Личные сведения, контакты, программа и включение в кадровый резерв.'
  ],
  kinship: [
    'Родство и получатели',
    'Свяжите выплаты с получателем, не создавая полный профиль родственника.'
  ],
  payments: [
    'Выплаты и меры поддержки',
    'Ответьте по каждому блоку. Если выбрали «Да», заполните соответствующую форму.'
  ],
  category: ['Сведения по категории', 'Заполните применимые сведения и документ-основание.'],
  payment: [
    'Единовременная выплата',
    'Событие, получатель, применимое основание и дата фактического перечисления.'
  ],
  support: [
    'Федеральная, региональная и муниципальная поддержка',
    'Каждый уровень учитывается отдельно. Для полученной меры нужен документ-основание.'
  ],
  insurance: [
    'Страховые выплаты и компенсации',
    'Отдельно укажите личные выплаты и выплаты, полученные за родственника — участника СВО.'
  ],
  housing: ['Жилищные меры', 'Отделите полученную меру от планируемой и укажите документальное основание.'],
  activities: [
    'Экспертная и преподавательская деятельность',
    'Организация, вид оформления, период и документ-основание.'
  ],
  documents: [
    'Документы профиля',
    'НПА, приказы, договоры и справки уполномоченных органов — без банковских выписок.'
  ],
  selfcheck: ['Самопроверка и отправка', ''],
  messages: ['Уточнения по сведениям', 'Вопросы специалиста, ответы кандидата в резерв и новая версия профиля.'],
  queue: [
    'Поступило на проверку',
    'Только назначенные вам материалы, которые кандидаты в резерв отправили на рассмотрение.'
  ],
  case: ['Карточка кандидата в резерв', 'Представленная версия сведений. Личный черновик кандидата в резерв недоступен.'],
  signals: ['Карточка сигналов', 'Получатель → вид выплаты → основание → период → документ. Сигнал не означает нарушения.'],
  result: ['Результат рассмотрения', 'Обоснованный статус материала фиксирует уполномоченный специалист.'],
  history: ['Версии и журнал действий', 'Представленные версии, запросы и основания изменения статуса.'],
  instructions: ['Порядок работы с профилем', ''],
  print: ['Единая печатная анкета', 'Все введённые сведения из разделов профиля в одном документе.'],
  templates: ['Шаблоны и памятки', 'Учебные заготовки для заполнения, не официальные формы назначения выплат.']
}

export const categoryDefinitions = [
  {
    title: 'Денежное довольствие',
    note: 'Приказ о назначении на должность',
    icon: <WalletCards size={19} />,
  },
  {
    title: 'Надбавки и дополнительные выплаты',
    note: 'Приказ + дополнительные основания при наличии',
    icon: <HandCoins size={19} />,
  },
  {
    title: 'Единовременные выплаты, связанные со службой',
    note: 'Событие, дата, получатель и применимое НПА',
    icon: <BadgeCheck size={19} />,
    target: 'payment' as Screen
  },
  {
    title: 'Федеральная, региональная и муниципальная поддержка',
    note: 'Уровень, орган назначения и обязательное основание',
    icon: <Landmark size={19} />,
    target: 'support' as Screen
  },
  {
    title: 'Страховые выплаты и компенсации',
    note: 'Личные выплаты и выплаты за родственника — раздельно',
    icon: <ShieldCheck size={19} />,
    target: 'insurance' as Screen
  },
  {
    title: 'Пенсии и социальные выплаты',
    note: 'Ответ обязателен. Документ не требуется',
    icon: <FileCheck2 size={19} />,
  },
  {
    title: 'Выплаты членам семьи за кандидата в резерв',
    note: 'Получатель, степень родства, ФИО и год рождения',
    icon: <UsersRound size={19} />,
  },
  {
    title: 'Материальная помощь организаций и фондов',
    note: 'Назначение, денежная или натуральная форма',
    icon: <Building2 size={19} />,
  },
  {
    title: 'Жилищные меры',
    note: 'Предполагаемый год и документ для планируемой меры',
    icon: <Home size={19} />,
    target: 'housing' as Screen
  },
  {
    title: 'Неденежные меры поддержки',
    note: 'Учитываются отдельно, в доход не включаются',
    icon: <BookOpen size={19} />,
  }
]
export const signalDefinitions = [
  {
    code: 'РО-01',
    type: 'Получатель и основание',
    title: 'Выплата за родственника записана как личная',
    action:
      'Уточнить основание и связать получателя с родственником. Не смешивать эту выплату с выплатами за личную службу.'
  },
  {
    code: 'ДУ-01',
    type: 'Повторный учёт',
    title: 'Две записи относятся к одному назначению',
    action:
      'Сверить документы: было ли два самостоятельных перечисления или одна выплата ошибочно внесена в разные категории.'
  },
  {
    code: 'ДЕ-01',
    type: 'Дополнительная деятельность',
    title: 'Период преподавания пересекается со службой',
    action:
      'Проверить условия договора и наличие требуемого уведомления. Само пересечение дат не устанавливает нарушение.'
  }
]
