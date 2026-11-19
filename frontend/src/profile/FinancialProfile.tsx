import { useEffect, useRef } from 'react'
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  Info,
  LockKeyhole,
  LogOut,
  Menu,
  Printer,
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
import { PrintScreen, TemplatesScreen } from './print'
import { headings } from './data'
import { Panel, Notice, downloadUrl } from './ui'
import './financial-profile.css'

export type PrototypeUser = { username: string; display_name: string; role: string }

export default function FinancialProfile({
  role: initialRole,
  user,
  onLogout,
  onQuickLogin,
  authenticated = true
}: {
  role: 'reservist' | 'reviewer'
  user: PrototypeUser
   onLogout: () => void | Promise<void>
   onQuickLogin?: () => void | Promise<void>
  authenticated?: boolean
}) {
  const m = useProfileModel(initialRole, authenticated ? user.display_name || user.username : '', user.username)
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
    navigate,
    nav,
    activeNav,
    protectedReviewerScreen
  } = m

  const displayName = user.display_name || user.username
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
  const roleLabel = role === 'reservist' ? 'Резервист' : 'Проверяющий'
  const closedEditing = role === 'reservist' && m.reviewerClosed
    && ['profile', 'kinship', 'payments', 'category', 'payment', 'support', 'insurance', 'housing', 'activities', 'selfcheck'].includes(screen)
  const modalRef = useRef<HTMLElement | null>(null)
  const lastFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!preview || !authenticated) return
    lastFocused.current = document.activeElement as HTMLElement | null
    const focusable = () =>
      Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'button, a[href], iframe, [tabindex]:not([tabindex="-1"])'
        ) || []
      )
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreview(null)
        return
      }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      lastFocused.current?.focus()
    }
  }, [preview, setPreview, authenticated])

  // Gate размонтирует модель при выходе/смене аккаунта. Данные живут на сервере.
  if (!authenticated) return null

  return (
    <div className="fp-shell">
      <a className="fp-skip-link" href="#fp-main">
        Перейти к содержимому
      </a>
      <aside id="fp-sidebar" className={`fp-sidebar ${mobileNav ? 'open' : ''}`}>
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
               disabled={role === 'reviewer' && !sent && !['queue', 'instructions', 'templates'].includes(item.screen)}
              title={
                 role === 'reviewer' && !sent && !['queue', 'instructions', 'templates'].includes(item.screen)
                  ? 'Доступно после отправки версии резервистом'
                  : item.title
              }
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
            {m.contacts.map((contact) => (
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
               Серверный учебный контур · 20.11.2026
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
            aria-expanded={mobileNav}
            aria-controls="fp-sidebar"
            onClick={() => setMobileNav(true)}
          >
            <Menu size={21} />
          </button>
          <div className="fp-api-role" aria-label="Роль получена через API" data-profile={role} data-user={user.username}>
            {role === 'reservist' ? <UserRound size={16} /> : <ShieldCheck size={16} />}
            <span>{roleLabel}</span>
            <small>{user.username}</small>
          </div>
          <div className="fp-topbar-right">
            <span className="fp-demo-tag">
              <i />
              Учебный контур · синтетические сведения
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
              <span className="fp-avatar">{initials}</span>
              <div>
                <strong>{displayName}</strong>
                <small>{roleLabel} · учебный аккаунт</small>
              </div>
              <ChevronDown size={14} />
            </div>
               <button className="fp-icon-button" aria-label="Выйти" disabled={m.busy || m.loading} onClick={() => m.leaveAccount(onLogout)} title="Выйти">
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="fp-main" id="fp-main" tabIndex={-1}>
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
            {screen !== 'print' && screen !== 'templates' && <button className="fp-button fp-button-outline"
               disabled={m.loading || (role === 'reviewer' && !sent) || (role === 'reservist' && !m.profileLoaded)} onClick={() => navigate('print')}>
              <Printer size={16} />Печать
            </button>}
          </div>
          <div className="fp-sync-bar" role="status" aria-live="polite">
            <span>{m.loading ? 'Загружаем данные с сервера…' : m.busy ? 'Ожидаем подтверждение сервера…' : role === 'reviewer' ? 'Только назначенные представленные версии'
              : m.saveState === 'saved' ? `Черновик сохранён на сервере${m.savedAt ? ` · ${m.savedAt}` : ''}`
                : m.saveState === 'saving' ? 'Сохраняем черновик…' : m.saveState === 'dirty' ? 'Есть изменения, ожидающие сохранения' : 'Сохранение не подтверждено'}</span>
            <div>{role === 'reservist' && m.editable && <button className="fp-text-button" disabled={m.busy || m.saveState === 'saving'} onClick={m.saveDraft}>Сохранить сейчас</button>}
              <button className="fp-text-button" disabled={m.busy || m.loading} onClick={m.reloadFromServer}>Обновить с сервера</button>
              {role === 'reservist' && m.hasUnsavedChanges && <button className="fp-text-button" onClick={m.exportDraft}>Локальная JSON-копия</button>}</div>
          </div>
           {m.error && <div role="alert" className="fp-server-error"><Notice tone="red"><strong>Состояние операции.</strong> {m.error}</Notice></div>}
          {m.loading ? <Panel className="fp-empty"><ShieldCheck size={32} /><h2>Загрузка с сервера</h2><p>Читаем профиль, версии и назначенный доступ.</p></Panel>
          : role === 'reservist' && !m.profileLoaded && screen !== 'templates' && screen !== 'instructions' ? <Panel className="fp-empty"><h2>Данные профиля не загружены</h2><p>Проверьте подключение к обновлённому API и нажмите «Обновить с сервера».</p></Panel>
          : closedEditing ? (
            <Panel className="fp-empty">
              <LockKeyhole size={35} />
              <h2>Рассмотрение закрыто</h2>
              <p>Редактирование закончено. Все представленные сведения доступны в единой анкете.</p>
              <button className="fp-button" onClick={() => { navigate('print'); m.setPrintSource('submitted') }}><Printer size={16} />Посмотреть анкету</button>
            </Panel>
          ) : protectedReviewerScreen ? (
            <Panel className="fp-empty">
              <LockKeyhole size={35} />
              <h2>Материал ещё не представлен</h2>
              <p>
                Личный черновик резервиста недоступен. Отправьте профиль в демонстрационной роли резервиста.
              </p>
            </Panel>
          ) : (
            <fieldset className="fp-screen-content" disabled={m.busy || role === 'reservist' && !m.editable && ['profile', 'kinship', 'payments', 'category', 'payment', 'support', 'insurance', 'housing', 'activities', 'selfcheck'].includes(screen)}>
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
               {screen === 'queue' && QueueScreen(m, onQuickLogin ? () => { void m.leaveAccount(onQuickLogin) } : undefined)}
              {screen === 'case' && CaseScreen(m)}
              {screen === 'signals' && SignalsScreen(m)}
              {screen === 'messages' && MessagesScreen(m)}
              {screen === 'result' && ResultScreen(m)}
              {screen === 'history' && HistoryScreen(m)}
              {screen === 'instructions' && InstructionsScreen(m)}
              {screen === 'print' && PrintScreen(m)}
              {screen === 'templates' && TemplatesScreen(m)}
            </fieldset>
          )}
          <footer className="fp-footer">
            <div>
              <ShieldCheck size={15} />
              <span>Макет на вымышленных данных · команда «Резонанс»</span>
            </div>
            <small>
              Не заменяет «Справки БК» и официальную проверку. Решение о назначении принимается вне платформы.
            </small>
            <div className="fp-footer-contacts" aria-label="Контакты ответственных сотрудников">
              {m.contacts.map((contact) => <div key={contact.email}>
                <strong>{contact.responsibility} · {contact.name}</strong>
                <span>{contact.phone} · {contact.email}</span>
              </div>)}
            </div>
            <small>Контакты вымышлены. Технические вопросы адресуются оператору, а не являются обращением в рамках 59-ФЗ.</small>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="fp-toast" role="status" aria-live="polite" aria-atomic="true">
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
            className="fp-modal fp-modal-file"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fp-preview-title"
            ref={modalRef}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fp-modal-head">
              <h2 id="fp-preview-title">{preview.name}</h2>
              <button
                className="fp-icon-button"
                aria-label="Закрыть документ"
                onClick={() => setPreview(null)}
              >
                <X size={20} />
              </button>
            </div>
            {preview.name.toLowerCase().endsWith('.pdf') ? (
              <iframe className="fp-file-frame" src={preview.url} title={`Документ ${preview.name}`} />
            ) : /\.(png|jpe?g)$/i.test(preview.name) ? (
              <img className="fp-scan-preview" src={preview.url} alt={`Скан ${preview.name}`} />
            ) : (
              <Notice tone="neutral">
                Для этого формата встроенный просмотр недоступен. Скачайте файл, чтобы открыть его локально.
              </Notice>
            )}
            <div className="fp-modal-actions">
              <a className="fp-button" href={downloadUrl(preview.url)} download={preview.name} onClick={() => m.recordDownload(preview.name)}>
                <Download size={16} /> Скачать
              </a>
              <button className="fp-button fp-button-outline" onClick={() => setPreview(null)}>
                Закрыть
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}
