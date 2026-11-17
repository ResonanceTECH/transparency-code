import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Info,
  LockKeyhole,
  Menu,
  ShieldCheck,
  UserRound,
  X
} from 'lucide-react'
import { useProfileModel } from './model'
import {
  HomeScreen,
  ProfileScreen,
  KinshipScreen,
  PaymentsScreen,
  CategoryScreen,
  PaymentScreen,
  SupportScreen,
  InsuranceScreen,
  HousingScreen,
  ActivitiesScreen,
  DocumentsScreen,
  SelfCheckScreen,
  QueueScreen,
  CaseScreen,
  SignalsScreen,
  MessagesScreen,
  ResultScreen,
  HistoryScreen,
  InstructionsScreen
} from './screens'
import { person, responsibleContacts, headings, documents } from './data'
import { Panel, PanelTitle, Notice } from './ui'
import './financial-profile.css'

export default function FinancialProfile() {
  const m = useProfileModel()
  const {
    role,
    screen,
    mobileNav,
    setMobileNav,
    preview,
    setPreview,
    question,
    toast,
    setToast,
    sent,
    version,
    navigate,
    switchRole,
    nav,
    activeNav,
    protectedReviewerScreen
  } = m
  return (
    <div className="fp-shell">
      <aside className={`fp-sidebar ${mobileNav ? 'open' : ''}`}>
        <button className="fp-mobile-close" aria-label="Закрыть меню" onClick={() => setMobileNav(false)}>
          <X size={20} />
        </button>
        <button className="fp-brand" onClick={() => navigate(role === 'reservist' ? 'home' : 'queue')}>
          <span>
            <ShieldCheck size={27} />
          </span>
          <div>
            <strong>РЕЗОНАНС</strong>
            <small>Финансовый профиль резервиста</small>
          </div>
        </button>
        <div className="fp-workspace-label">
          <span />
          {role === 'reservist' ? 'ЛИЧНЫЙ КАБИНЕТ' : 'УПОЛНОМОЧЕННЫЙ СПЕЦИАЛИСТ'}
        </div>
        <nav aria-label={role === 'reservist' ? 'Разделы резервиста' : 'Разделы проверяющего'}>
          {nav.map((item) => (
            <button
              key={item.screen}
              aria-label={item.title}
              className={activeNav === item.screen ? 'active' : ''}
              onClick={() => navigate(item.screen)}
              disabled={role === 'reviewer' && !sent && item.screen !== 'queue'}
            >
              {item.icon}
              <span>{item.title}</span>
              {item.screen === 'messages' && question && <em aria-hidden="true">1</em>}
            </button>
          ))}
        </nav>
        <div className="fp-sidebar-bottom">
          <button
            className={`fp-sidebar-instructions ${screen === 'instructions' ? 'active' : ''}`}
            onClick={() => navigate('instructions')}
          >
            <BookOpen size={19} />
            {role === 'reservist' ? 'Инструкция по заполнению' : 'Порядок рассмотрения'}
          </button>
          <div className="fp-sidebar-contacts">
            <span>ОТВЕТСТВЕННЫЕ СОТРУДНИКИ</span>
            {responsibleContacts.map((contact) => (
              <div className="fp-sidebar-contact" key={contact.name}>
                <small>{contact.responsibility}</small>
                <strong>{contact.name}</strong>
                <span>{contact.phone}</span>
                <span>{contact.email}</span>
              </div>
            ))}
            <small>Демонстрационные контакты</small>
          </div>
          <div className="fp-sidebar-version">
            <ShieldCheck size={14} />
            Макет интерфейса · 10.11.2026
          </div>
        </div>
      </aside>
      {mobileNav && (
        <button className="fp-menu-overlay" aria-label="Закрыть меню" onClick={() => setMobileNav(false)} />
      )}
      <div className="fp-workspace">
        <header className="fp-topbar">
          <button
            className="fp-mobile-menu fp-icon-button"
            aria-label="Открыть меню"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={21} />
          </button>
          <div className="fp-role-switch" aria-label="Демонстрационная смена роли">
            <button className={role === 'reservist' ? 'active' : ''} onClick={() => switchRole('reservist')}>
              <UserRound size={16} />
              Резервист
            </button>
            <button className={role === 'reviewer' ? 'active' : ''} onClick={() => switchRole('reviewer')}>
              <ShieldCheck size={16} />
              Проверяющий
            </button>
          </div>
          <div className="fp-topbar-right">
            <span className="fp-demo-tag">
              <i />
              Макет · синтетические сведения
            </span>
            <button
              className="fp-icon-button fp-bell"
              aria-label="Уведомления"
              onClick={() => navigate('messages')}
            >
              <Bell size={19} />
              {question && <i />}
            </button>
            <div className="fp-topbar-person">
              <span className="fp-avatar">{role === 'reservist' ? 'АК' : 'АИ'}</span>
              <div>
                <strong>{role === 'reservist' ? 'Алексей Ковалёв' : 'Анна Иванова'}</strong>
                <small>{role === 'reservist' ? 'Резервист · демо' : 'Кадровый специалист · демо'}</small>
              </div>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>
        <main className="fp-main">
          <div className={`fp-page-header ${screen === 'home' ? 'fp-page-header-home' : ''}`}>
            <div>
              <div className="fp-breadcrumb">
                {role === 'reservist' ? 'ЛИЧНЫЙ КАБИНЕТ' : 'РАССМОТРЕНИЕ СВЕДЕНИЙ'}
                <ChevronRight size={12} />
                <span>{screen === 'home' || screen === 'queue' ? 'ОБЗОР' : 'ФИНАНСОВЫЙ ПРОФИЛЬ'}</span>
              </div>
              <h1>
                {screen === 'instructions'
                  ? role === 'reservist'
                    ? 'Инструкция по заполнению'
                    : 'Порядок рассмотрения'
                  : headings[screen][0]}
              </h1>
              {headings[screen][1] && <p>{headings[screen][1]}</p>}
            </div>
          </div>
          {protectedReviewerScreen ? (
            <Panel className="fp-empty">
              <LockKeyhole size={35} />
              <h2>Материал ещё не представлен</h2>
              <p>
                Личный черновик резервиста недоступен. Отправьте профиль в демонстрационной роли резервиста.
              </p>
            </Panel>
          ) : (
            <>
              {screen === 'home' && HomeScreen(m)}
              {screen === 'profile' && ProfileScreen(m)}
              {screen === 'kinship' && KinshipScreen(m)}
              {screen === 'payments' && PaymentsScreen(m)}
              {screen === 'category' && CategoryScreen(m)}
              {screen === 'payment' && PaymentScreen(m)}
              {screen === 'support' && SupportScreen(m)}
              {screen === 'insurance' && InsuranceScreen(m)}
              {screen === 'housing' && HousingScreen(m)}
              {screen === 'activities' && ActivitiesScreen(m)}
              {screen === 'documents' && DocumentsScreen(m)}
              {screen === 'selfcheck' && SelfCheckScreen(m)}
              {screen === 'queue' && QueueScreen(m)}
              {screen === 'case' && CaseScreen(m)}
              {screen === 'signals' && SignalsScreen(m)}
              {screen === 'messages' && MessagesScreen(m)}
              {screen === 'result' && ResultScreen(m)}
              {screen === 'history' && HistoryScreen(m)}
              {screen === 'instructions' && InstructionsScreen(m)}
            </>
          )}
          <footer className="fp-footer">
            <div>
              <ShieldCheck size={15} />
              <span>Макет на вымышленных данных · команда «Резонанс»</span>
            </div>
            <small>
              Не заменяет «Справки БК» и официальную проверку. Решение о назначении принимается вне платформы.
            </small>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="fp-toast" role="status">
          <Info size={18} />
          {toast}
          <button className="fp-icon-button" aria-label="Закрыть уведомление" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {preview && (
        <div className="fp-modal-backdrop" onClick={() => setPreview(null)}>
          <section
            className="fp-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Учебный документ"
            onClick={(e) => e.stopPropagation()}
          >
            <PanelTitle
              title="Учебный документ"
              action={
                <button
                  className="fp-icon-button"
                  aria-label="Закрыть документ"
                  onClick={() => setPreview(null)}
                >
                  <X size={20} />
                </button>
              }
            />
            <Notice tone="neutral">
              Это демонстрационный фрагмент, не реальный документ ведомства и не результат OCR.
            </Notice>
            <h3>{preview}</h3>
            <p>
              Все реквизиты, лица и суммы в макете вымышлены. Документы служат иллюстрацией схемы «получатель
              → вид → основание → период → документ».
            </p>
            <button className="fp-button" onClick={() => setPreview(null)}>
              Закрыть
            </button>
          </section>
        </div>
      )}
    </div>
  )
}
