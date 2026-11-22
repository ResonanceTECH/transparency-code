import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../shared/api'
import FinancialProfile, { type PrototypeUser } from './FinancialProfile'
import { ShieldCheck, LogIn } from 'lucide-react'
import './financial-profile.css'

type SessionOut = { authenticated: boolean; user: PrototypeUser | null }

const DEMO_PASSWORD = 'resonance-demo-2026'

const demoAccounts: { username: string; label: string; note: string }[] = [
  { username: 'reservist', label: 'Кандидат в резерв', note: 'собственный серверный черновик' },
  { username: 'reviewer', label: 'Проверяющий', note: 'только назначенные материалы' }
]

function prototypeRole(role: string): 'reservist' | 'reviewer' | null {
  if (role === 'reservist') return 'reservist'
  // specialist (demo) и reviewer работают с одинаковой проверкой назначений в API.
  if (role === 'reviewer' || role === 'specialist') return 'reviewer'
  return null
}

export default function FinancialProfileGate() {
  const [user, setUser] = useState<PrototypeUser | null>(null)
  const [activeRole, setActiveRole] = useState<'reservist' | 'reviewer' | null>(null)
  const [checking, setChecking] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    api<SessionOut>('/auth/session')
      .then((session) => {
        if (!active || !session.authenticated || !session.user) return
        const mapped = prototypeRole(session.user.role)
        if (!mapped) return
        setUser(session.user)
        setActiveRole(mapped)
      })
      .catch(() => {
        // Гость видит форму входа — это ожидаемое состояние прототипа.
      })
      .finally(() => active && setChecking(false))
    return () => {
      active = false
    }
  }, [])

  const enter = (nextUser: PrototypeUser) => {
    const mapped = prototypeRole(nextUser.role)
    if (!mapped) {
      setError('Этот аккаунт не подходит для демонстрационного профиля')
      return
    }
    setUser(nextUser)
    setActiveRole(mapped)
    setError('')
    setPassword('')
  }

  const login = async (loginName: string, loginPassword: string) => {
    setBusy(true)
    setError('')
    try {
      const nextUser = await api<PrototypeUser>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginName, password: loginPassword })
      })
      enter(nextUser)
      return true
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось войти')
      return false
    } finally {
      setBusy(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    void login(username.trim(), password)
  }

  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST', headers: { 'X-Profile-Account': user?.username || '' } })
    } catch (failure) {
      if (!(failure instanceof ApiError && failure.status === 401)) throw failure
      // Истёкшая сессия уже закрыта; ошибка сети или иной аккаунт — не подтверждение выхода.
    }
    setUser(null)
    setActiveRole(null)
    setUsername('')
    setPassword('')
  }

  useEffect(() => {
    if (!user) return
    let active = true
    const check = () => {
      void api<SessionOut>('/auth/session').then((session) => {
        if (!active) return
        if (!session.authenticated || !session.user) { setUser(null); setActiveRole(null); return }
        if (session.user.username !== user.username || session.user.role !== user.role) enter(session.user)
      }).catch(() => { /* Сбой сети не удаляет подтверждённый профиль. Следующая операция покажет ошибку. */ })
    }
    window.addEventListener('focus', check)
    return () => { active = false; window.removeEventListener('focus', check) }
  }, [user?.username, user?.role])

  const quickReservist = async () => {
    if (!await login('reservist', DEMO_PASSWORD)) throw new Error('Переключение аккаунта не подтверждено сервером. Повторите вход при восстановлении подключения.')
  }

  const loginForm = (
    <div className={`fp-gate-card${activeRole ? ' fp-gate-card-overlay' : ''}`}>
      <span className="fp-gate-mark"><ShieldCheck size={30} /></span>
      <h1>Финансовый профиль кандидата в резерв</h1>
      <p>Учебный контур с серверным сохранением профилей и ролями из API.</p>
      <form onSubmit={submit}>
        <label>
          Логин
          <input aria-label="Логин" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label>
          Пароль
          <input aria-label="Пароль" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div className="fp-gate-error" role="alert">{error}</div>}
        <button type="submit" disabled={busy}>
          <LogIn size={16} /> Войти
        </button>
      </form>
      <div className="fp-gate-demo">
        <span>Быстрый вход</span>
        {demoAccounts.map((account) => (
          <button
            key={account.username}
            type="button"
            disabled={busy}
            onClick={() => {
              setUsername(account.username)
              setPassword(DEMO_PASSWORD)
              void login(account.username, DEMO_PASSWORD)
            }}
          >
            <b>{account.label}</b>
            <small>{account.note}</small>
          </button>
        ))}
      </div>
      <small className="fp-gate-footnote">Пароль для всех учебных аккаунтов: {DEMO_PASSWORD}. Только синтетические сведения.</small>
    </div>
  )

  if (checking && !activeRole) {
    return (
      <div className="fp-gate">
        <div className="fp-gate-card">
          <ShieldCheck size={34} />
          <h1>Резонанс</h1>
          <p>Проверяем демонстрационную сессию…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {activeRole && user && (
        <FinancialProfile
          key={`${user.username}:${user.role}`}
          role={activeRole}
          user={user}
           onLogout={logout}
           onQuickLogin={quickReservist}
          authenticated={!!user}
        />
      )}
      {!user && <div className="fp-gate fp-gate-overlay">{loginForm}</div>}
    </>
  )
}
