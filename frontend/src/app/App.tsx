import type { ReactNode } from 'react'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  FileCheck2,
  FolderOpen,
  LayoutDashboard,
  Plus,
  Settings2,
  X,
  CircleHelp,
  ClipboardList,
  Diamond,
  Files,
  LogOut,
  Printer,
  RefreshCw,
  Target
} from 'lucide-react'
import { api } from './api'
import { useAppModel } from './model'
import {
  OverviewView,
  ChecksView,
  NewView,
  CaseView,
  DocumentsView,
  AnalysisView,
  EvidenceView,
  RulesView,
  ReportView
} from './views'
import type { View } from './types'
import { labels } from './format'
import { Panel, Notice } from './ui'
import './styles.css'

export default function App() {
  const m = useAppModel()
  const {
    user,
    setUser,
    boot,
    view,
    cases,
    setCases,
    detail,
    setDetail,
    rules,
    enabled,
    busy,
    error,
    toast,
    setToast,
    edit,
    setEdit,
    about,
    setAbout,
    loginName,
    setLoginName,
    loginPassword,
    setLoginPassword,
    form,
    refresh,
    task,
    go,
    openCase,
    analyzeCase
  } = m
  const title: Record<View, [string, string, string]> = {
    overview: [
      '01 / РАБОЧАЯ ПАНЕЛЬ',
      'Обзор проверок',
      'Актуальные дела, сигналы и действия, требующие вашего внимания.'
    ],
    checks: [
      '02 / РЕЕСТР',
      'Все проверки',
      'Отслеживайте дела и переходите к материалам предварительного анализа.'
    ],
    new: [
      '03 / СОЗДАНИЕ ДЕЛА',
      'Новая проверка',
      'Укажите контекст анализа. В прототипе разрешены только вымышленные сведения.'
    ],
    case: [
      'КАРТОЧКА ДЕЛА / ' + (detail?.number || ''),
      'Проверка сведений',
      'Материалы, результаты и история действий по одному делу.'
    ],
    documents: [
      '04 / ДОКУМЕНТЫ',
      'Исходные сведения',
      'Загрузите документы, сверьте извлечённые поля и подтвердите их перед анализом.'
    ],
    analysis: [
      '05 / АВТОМАТИЗИРОВАННЫЙ АНАЛИЗ',
      'Результаты проверки',
      'Каждый сигнал связан с конкретным правилом и исходными значениями.'
    ],
    evidence: [
      '06 / РАССМОТРЕНИЕ СИГНАЛА',
      'Карточка расхождения',
      'Сопоставьте источники и зафиксируйте решение с обоснованием.'
    ],
    report: [
      '07 / РЕЗУЛЬТАТ',
      'Итог предварительного анализа',
      'Проект рабочего документа из результатов и решений специалиста.'
    ],
    rules: ['08 / КОНФИГУРАЦИЯ', 'Правила анализа', 'Прозрачные методические условия для следующего запуска.']
  }
  const nav: [View, React.ReactNode][] = [
    ['overview', <LayoutDashboard size={18} />],
    ['checks', <ClipboardList size={18} />],
    ['new', <Plus size={18} />],
    ['documents', <Files size={18} />],
    ['analysis', <Diamond size={18} />],
    ['evidence', <Target size={18} />],
    ['report', <FileCheck2 size={18} />]
  ]

  if (boot) return <div className="startup">Подключение к Резонансу…</div>
  if (!user)
    return (
      <main className="login">
        <div className="login-brand">
          <Diamond size={36} />
          <h1>РЕЗОНАНС</h1>
          <p>Проверка сведений · демонстрационный прототип</p>
        </div>
        <form
          className="panel login-form"
          onSubmit={(e) => {
            e.preventDefault()
            task(async () => {
              const result = await api<{ username: string }>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username: loginName, password: loginPassword })
              })
              setUser(result.username)
            })
          }}
        >
          <h2>Рабочее пространство</h2>
          <p>Только синтетические данные. Юридически значимые решения система не принимает.</p>
          <label>
            Логин
            <input
              autoComplete="username"
              value={loginName}
              onChange={(e) => setLoginName(e.target.value)}
              required
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              autoComplete="current-password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              required
            />
          </label>
          {error && <Notice warning>{error}</Notice>}
          <button disabled={busy} type="submit">
            {busy ? 'Входим…' : 'Войти'} <ArrowRight size={17} />
          </button>
          <small>
            Локальный аккаунт по умолчанию: demo / resonance-demo-2026.
            <br />
            Если меняли .env, используйте свои реквизиты.
          </small>
        </form>
      </main>
    )

  const requiresCase = ['case', 'documents', 'analysis', 'evidence', 'report'].includes(view)
  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" onClick={() => go('overview')}>
          <span className="brand-icon">
            <Diamond size={27} strokeWidth={2.5} />
          </span>
          <span>
            <b>РЕЗОНАНС</b>
            <small>Проверка сведений</small>
          </span>
        </button>
        <div className="nav-heading">РАБОЧЕЕ ПРОСТРАНСТВО</div>
        <nav>
          {nav.map(([key, icon]) => (
            <button
              key={key}
              className={view === key || (key === 'checks' && view === 'case') ? 'active' : ''}
              onClick={() => go(key)}
              disabled={busy}
            >
              {icon}
              <span>{labels[key]}</span>
              {key === 'analysis' && !!detail?.pending_count && <em>{detail.pending_count}</em>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="nav-heading">СИСТЕМА</div>
          <button className={`system-link ${view === 'rules' ? 'active' : ''}`} onClick={() => go('rules')}>
            <Settings2 size={18} />
            Правила проверки
          </button>
          <button className="system-link" onClick={() => setAbout(true)}>
            <CircleHelp size={18} />О системе
          </button>
          <div className="demo-note">
            <strong>
              <i />
              Демо-режим
            </strong>
            <p>
              Все сведения вымышленные.
              <br />
              Решение принимает специалист.
            </p>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            Рабочее пространство <ChevronRight size={14} /> <b>{labels[view]}</b>
          </span>
          <div>
            <span className="synthetic-tag">Синтетические данные</span>
            <div className="avatar">ДМ</div>
            <div className="user">
              <b>{user}</b>
              <small>Специалист · учебный аккаунт</small>
            </div>
            <button
              className="icon-button"
              aria-label="Выйти"
              onClick={() =>
                task(async () => {
                  await api('/auth/logout', { method: 'POST' })
                  setUser(null)
                  setDetail(null)
                  setCases([])
                  go('overview')
                })
              }
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">{title[view][0]}</div>
              <h1>{title[view][1]}</h1>
              <p>{title[view][2]}</p>
            </div>
            <div className="actions">
              {['overview', 'checks'].includes(view) && (
                <button onClick={() => go('new')}>
                  <Plus size={17} />
                  Новая проверка
                </button>
              )}
              {detail && ['case', 'documents', 'analysis'].includes(view) && (
                <button disabled={busy || !enabled.length} onClick={analyzeCase}>
                  <Activity size={17} />
                  {busy ? 'Обработка…' : 'Запустить анализ'}
                </button>
              )}
              {['analysis', 'evidence'].includes(view) && detail && (
                <button className="secondary" onClick={() => go('documents')}>
                  <ArrowLeft size={16} />
                  Документы
                </button>
              )}
              {view === 'report' && detail && (
                <>
                  <button
                    className="secondary"
                    onClick={() =>
                      task(async () => {
                        const result = await api(`/cases/${detail.id}/report`)
                        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `${detail.number}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      })
                    }
                  >
                    <Download size={16} />
                    JSON
                  </button>
                  <button onClick={() => window.print()}>
                    <Printer size={16} />
                    Печать / PDF
                  </button>
                </>
              )}
            </div>
          </div>
          {error && (
            <div role="alert">
              <Notice warning>{error}</Notice>
            </div>
          )}
          {toast && (
            <div className="toast" role="status">
              <Check size={18} />
              {toast}
              <button className="icon-button" onClick={() => setToast('')} aria-label="Закрыть уведомление">
                <X size={16} />
              </button>
            </div>
          )}
          {detail && requiresCase && (
            <div className="case-strip">
              <button className="link" onClick={() => go('case')}>
                {detail.number}
              </button>
              <span>{detail.name}</span>
              <span className="muted">Отчётный год: {detail.year}</span>
              <button className="link" onClick={() => openCase(detail.id, view)} disabled={busy}>
                <RefreshCw size={14} />
                Обновить
              </button>
            </div>
          )}
          {detail?.stale && requiresCase && (
            <Notice warning>
              Сведения изменены после анализа. Ниже сохранённые результаты старого снимка; выполните новый
              анализ. Решения по устаревшим сигналам заблокированы.
            </Notice>
          )}
          {requiresCase && !detail ? (
            <Panel>
              <div className="empty">
                <FolderOpen size={36} />
                <h2>Сначала выберите дело</h2>
                <p>Документы и результаты относятся к конкретной проверке.</p>
                <button onClick={() => go('checks')}>
                  Открыть реестр <ArrowRight size={16} />
                </button>
              </div>
            </Panel>
          ) : (
            <>
              {view === 'overview' && OverviewView(m)}
              {view === 'checks' && ChecksView(m)}
              {view === 'new' && NewView(m)}
              {view === 'case' && detail && CaseView(m)}
              {view === 'documents' && detail && DocumentsView(m)}
              {view === 'analysis' && detail && AnalysisView(m)}
              {view === 'evidence' && detail && EvidenceView(m)}
              {view === 'rules' && RulesView(m)}
              {view === 'report' && detail && ReportView(m)}
            </>
          )}
          <p className="page-footnote">
            Демонстрационный прототип команды «Резонанс». Только вымышленные данные. Решение по существу
            принимает уполномоченный специалист.
          </p>
        </main>
      </div>
      {edit && (
        <div className="modal-backdrop">
          <form
            className="modal panel"
            onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              task(async () => {
                await api(`/facts/${edit.id}`, {
                  method: 'PATCH',
                  body: JSON.stringify({
                    value: formData.get('value'),
                    date: formData.get('date') || null,
                    unit: formData.get('unit'),
                    confirmed: formData.get('confirmed') === 'on'
                  })
                })
                await refresh()
                setEdit(null)
                setToast('Поле сохранено. Старые запуски анализа не изменены.')
              })
            }}
          >
            <div className="section-heading">
              <h2>Уточнить поле</h2>
              <button
                type="button"
                className="icon-button"
                aria-label="Закрыть"
                onClick={() => setEdit(null)}
              >
                <X />
              </button>
            </div>
            <p>
              {edit.label} · {edit.document_name}
            </p>
            <blockquote>{edit.snippet}</blockquote>
            <label>
              Значение
              <input name="value" defaultValue={edit.value} required maxLength={300} />
            </label>
            <div className="form-row">
              <label>
                Дата
                <input name="date" type="date" defaultValue={edit.date || ''} />
              </label>
              <label>
                Единица / валюта
                <input name="unit" defaultValue={edit.unit} required maxLength={30} />
              </label>
            </div>
            <label className="checkbox">
              <input name="confirmed" type="checkbox" defaultChecked={edit.confirmed} />
              Сверено с источником
            </label>
            {error && <Notice warning>{error}</Notice>}
            <button type="submit" disabled={busy}>
              Сохранить
            </button>
          </form>
        </div>
      )}
      {about && (
        <div className="modal-backdrop">
          <section className="modal panel">
            <div className="section-heading">
              <h2>О Резонансе</h2>
              <button className="icon-button" aria-label="Закрыть" onClick={() => setAbout(false)}>
                <X />
              </button>
            </div>
            <p>
              Прототип поддержки предварительного анализа полноты и достоверности представленных сведений.
              Направление № 6.
            </p>
            <Notice>
              Не заменяет официальное ПО «Справки БК», установленный порядок подачи или юридически значимую
              проверку.
            </Notice>
            <p>
              Правила 0.1.0 · React + FastAPI + PostgreSQL. Нет внешнего ИИ или реестров. Поддержка документов
              ограничена учебным шаблоном.
            </p>
            <a className="link" href="/docs" target="_blank" rel="noreferrer">
              Документация API →
            </a>
          </section>
        </div>
      )}
    </div>
  )
}
