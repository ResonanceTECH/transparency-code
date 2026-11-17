import { useEffect, useState } from 'react'
import type { View, CaseSummary, CaseDetail, Fact, Rule, Signal } from './types'
import { api, ApiError } from './api'
import type { Me } from './profile'

export function useAppModel() {
  const [user, setUser] = useState<Me | null>(null)
  const [boot, setBoot] = useState(true)
  const [view, setView] = useState<View>('overview')
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [detail, setDetail] = useState<CaseDetail | null>(null)
  const [rules, setRules] = useState<Rule[]>([])
  const [enabled, setEnabled] = useState<string[]>([])
  const [signalId, setSignalId] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [edit, setEdit] = useState<Fact | null>(null)
  const [about, setAbout] = useState(false)
  const [loginName, setLoginName] = useState('demo')
  const [loginPassword, setLoginPassword] = useState('')
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [comment, setComment] = useState('')
  const [form, setForm] = useState({ name: '', department: '', basis: 'candidate', year: 2025 })
  const currentRun = detail?.runs.find((r) => r.id === selectedRun) || detail?.runs[0]
  const currentSignal = currentRun?.signals.find((s) => s.id === signalId)
  const archived = !!currentRun && currentRun.id !== detail?.runs[0]?.id

  useEffect(() => {
    api<Me>('/auth/me')
      .then((r) => setUser(r))
      .catch((e) => {
        if (!(e instanceof ApiError && e.status === 401)) setError(e.message)
      })
      .finally(() => setBoot(false))
  }, [])
  useEffect(() => {
    if (user) {
      Promise.all([api<CaseSummary[]>('/cases'), api<{ rules: Rule[] }>('/rules')])
        .then(([c, r]) => {
          setCases(c)
          setRules(r.rules)
          setEnabled(r.rules.map((x) => x.id))
        })
        .catch((e) => setError(e.message))
    }
  }, [user])
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(''), 4500)
      return () => clearTimeout(id)
    }
  }, [toast])

  async function refresh(id = detail?.id) {
    const [list, data] = await Promise.all([
      api<CaseSummary[]>('/cases'),
      id ? api<CaseDetail>(`/cases/${id}`) : Promise.resolve(null)
    ])
    setCases(list)
    if (data) setDetail(data)
    return data
  }
  async function task(fn: () => Promise<void>) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      const err = e as Error
      setError(err.message)
      if (e instanceof ApiError && e.status === 401) {
        setUser(null)
        setDetail(null)
        setCases([])
      }
    } finally {
      setBusy(false)
    }
  }
  function go(next: View) {
    setError('')
    setView(next)
    if (next === 'new') setForm({ name: '', department: '', basis: 'candidate', year: 2025 })
  }
  async function openCase(id: string, next: View = 'case') {
    await task(async () => {
      await refresh(id)
      setSelectedRun(null)
      setSignalId(null)
      go(next)
    })
  }
  async function createDemo(kind: string, clean = false) {
    await task(async () => {
      const c = await api<CaseSummary>('/cases', {
        method: 'POST',
        body: JSON.stringify({
          synthetic: true,
          name:
            kind === 'trade_in' ? 'Соколова Елена · вымышленное лицо' : 'Орлов Алексей · вымышленное лицо',
          department: 'Учебное подразделение',
          basis: 'candidate',
          year: 2025
        })
      })
      await api(`/cases/${c.id}/demo?kind=${kind}&clean=${clean}`, { method: 'POST' })
      await refresh(c.id)
      setSelectedRun(null)
      go('documents')
      setToast('Синтетический комплект добавлен. Сверьте и подтвердите поля.')
    })
  }
  async function analyzeCase() {
    if (!detail) return
    await task(async () => {
      await api(`/cases/${detail.id}/analysis-runs`, {
        method: 'POST',
        body: JSON.stringify({ enabled_rules: enabled })
      })
      await refresh()
      setSelectedRun(null)
      setSignalId(null)
      go('analysis')
      setToast('Новый анализ выполнен. Предыдущие запуски сохранены.')
    })
  }
  async function upload(files: FileList | null) {
    if (!detail || !files?.length) return
    const id = detail.id
    await task(async () => {
      for (const file of Array.from(files)) {
        if (file.size > 5 * 1024 * 1024) throw new Error('Размер каждого файла — не более 5 МБ.')
        const body = new FormData()
        body.append('file', file)
        await api(`/cases/${id}/documents`, { method: 'POST', body })
      }
      await refresh(id)
      setToast('Документ загружен. Проверьте статус извлечения и поля.')
    })
    await refresh(id).catch(() => {})
  }
  function openSignal(signal: Signal) {
    setSignalId(signal.id)
    setComment('')
    go('evidence')
  }

  const visibleCases = cases.filter(
    (c) =>
      `${c.number} ${c.name} ${c.department}`.toLowerCase().includes(search.toLowerCase()) &&
      (filter === 'all' || c.status === filter)
  )

  const requiresCase = ['case', 'documents', 'analysis', 'evidence', 'report'].includes(view)

  return {
    user,
    setUser,
    boot,
    setBoot,
    view,
    setView,
    cases,
    setCases,
    detail,
    setDetail,
    rules,
    setRules,
    enabled,
    setEnabled,
    signalId,
    setSignalId,
    selectedRun,
    setSelectedRun,
    busy,
    setBusy,
    error,
    setError,
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
    search,
    setSearch,
    filter,
    setFilter,
    comment,
    setComment,
    form,
    setForm,
    currentRun,
    currentSignal,
    archived,
    refresh,
    task,
    go,
    openCase,
    createDemo,
    analyzeCase,
    upload,
    openSignal,
    visibleCases,
    requiresCase
  }
}

export type AppModel = ReturnType<typeof useAppModel>
