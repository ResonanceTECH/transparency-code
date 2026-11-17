import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Download,
  FolderOpen,
  Plus,
  Search,
  ShieldCheck,
  Upload,
  ClipboardList,
  Diamond,
  Files,
  Target
} from 'lucide-react'
import { api } from './api'
import type { AppModel } from './model'
import type { CaseSummary } from './types'
import { statusLabels, dateText, basisText, displayValue } from './format'
import { Badge, Panel, Notice } from './ui'

function caseTable(m: AppModel, data: CaseSummary[]) {
  const { openCase, go } = m
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>НОМЕР</th>
            <th>ПРОВЕРЯЕМОЕ ЛИЦО</th>
            <th>КОНТЕКСТ</th>
            <th>ДАТА</th>
            <th>СТАТУС</th>
            <th>СИГНАЛЫ</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {data.map((c) => (
            <tr key={c.id}>
              <td>
                <button className="link" onClick={() => openCase(c.id)}>
                  {c.number}
                </button>
              </td>
              <td>
                <strong>{c.name}</strong>
                <small>{c.department}</small>
              </td>
              <td>{basisText(c.basis)}</td>
              <td>{dateText(c.created_at).split(',')[0]}</td>
              <td>
                <Badge status={c.status} />
                {c.stale && <small className="amber">Нужен повторный анализ</small>}
              </td>
              <td className="amber">{c.signals_count || '—'}</td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Открыть ${c.number}`}
                  onClick={() => openCase(c.id)}
                >
                  <ChevronRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data.length && (
        <div className="empty">
          <FolderOpen size={30} />
          <h3>Пока нет проверок</h3>
          <p>Создайте дело или добавьте демонстрационный комплект.</p>
          <button onClick={() => go('new')}>
            Создать дело <Plus size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

export function OverviewView(m: AppModel) {
  const { cases, detail, busy, filter, go, createDemo } = m
  return (
    <>
      <div className="stats">
        {[
          {
            label: 'Всего проверок',
            value: cases.length,
            note: 'В вашем рабочем пространстве',
            icon: <ClipboardList />,
            color: ''
          },
          {
            label: 'Требуют внимания',
            value: cases.filter((c) => c.pending_count > 0).length,
            note: 'Есть сигналы на рассмотрении',
            icon: <Target />,
            color: 'gold'
          },
          {
            label: 'Ожидают анализа',
            value: cases.filter((c) => c.status === 'draft').length,
            note: 'Добавьте и подтвердите сведения',
            icon: <Files />,
            color: ''
          },
          {
            label: 'Анализ завершён',
            value: cases.filter((c) => c.status === 'completed').length,
            note: 'Нет неразрешённых сигналов',
            icon: <Check />,
            color: 'green'
          }
        ].map((s) => (
          <section className="stat panel" key={s.label}>
            <div>
              <span>{s.label}</span>
              <i className={s.color}>{s.icon}</i>
            </div>
            <strong>{s.value}</strong>
            <small>{s.note}</small>
          </section>
        ))}
      </div>
      <div className="columns dashboard">
        <Panel title="Начните с рабочего сценария">
          <div className="intro-icon">
            <ShieldCheck size={29} />
          </div>
          <h2>От документа до объяснимого сигнала</h2>
          <p>
            Два учебных комплекта показывают проверку полноты сведений, сопоставление объектов и влияние
            отчётных дат.
          </p>
          <div className="demo-buttons">
            <button disabled={busy} onClick={() => createDemo('trade_in')}>
              Trade-in автомобиля <ArrowRight size={17} />
            </button>
            <button className="secondary" disabled={busy} onClick={() => createDemo('apartment')}>
              Покупка квартиры
            </button>
            <button className="text-button" disabled={busy} onClick={() => createDemo('trade_in', true)}>
              Чистый комплект
            </button>
          </div>
          <Notice>
            Встроенные факты подготовлены для демонстрации. Вы также можете загрузить свой синтетический
            комплект по шаблону.
          </Notice>
        </Panel>
        <Panel
          title="Последние действия"
          action={
            detail && (
              <button className="link" onClick={() => go('case')}>
                Открыть дело →
              </button>
            )
          }
        >
          {detail?.events.length ? (
            <div className="timeline">
              {detail.events.slice(0, 4).map((e) => (
                <div key={e.id}>
                  <small>{dateText(e.created_at)}</small>
                  <strong>{e.message.split(':')[0]}</strong>
                  <p>{e.author}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty compact">
              <Activity size={30} />
              <p>
                Выберите дело, чтобы увидеть его историю. Статистика вычисляется из БД, а не задана макетом.
              </p>
            </div>
          )}
        </Panel>
      </div>
      <div className="section-heading">
        <h2>Последние проверки</h2>
        <button className="link" onClick={() => go('checks')}>
          Все проверки →
        </button>
      </div>
      <section className="panel">{caseTable(m, cases.slice(0, 5))}</section>
    </>
  )
}

export function ChecksView(m: AppModel) {
  const { cases, search, setSearch, filter, setFilter, visibleCases } = m
  return (
    <>
      <div className="filters">
        <div className="search">
          <Search size={17} />
          <input
            aria-label="Поиск проверок"
            placeholder="Номер проверки, ФИО или подразделение"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select aria-label="Фильтр статуса" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Все статусы</option>
          <option value="draft">Ожидает анализа</option>
          <option value="attention">Требует внимания</option>
          <option value="completed">Анализ завершён</option>
        </select>
        <button
          className="secondary"
          onClick={() => {
            setSearch('')
            setFilter('all')
          }}
        >
          Сбросить
        </button>
      </div>
      <div className="summary-bar">
        Всего: <b>{cases.length}</b> · отображается: <b>{visibleCases.length}</b> · синтетические данные
      </div>
      <section className="panel">{caseTable(m, visibleCases)}</section>
    </>
  )
}

export function NewView(m: AppModel) {
  const { cases, setSelectedRun, busy, form, setForm, refresh, task, go } = m
  return (
    <>
      <div className="steps">
        <b>
          1 <span>Создание дела</span>
        </b>
        <i />
        <span>2 Документы</span>
        <i />
        <span>3 Анализ</span>
        <i />
        <span>4 Решение</span>
      </div>
      <div className="columns">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            task(async () => {
              const c = await api<CaseSummary>('/cases', {
                method: 'POST',
                body: JSON.stringify({
                  ...form,
                  department: form.department || 'Учебное подразделение',
                  synthetic: true
                })
              })
              await refresh(c.id)
              setSelectedRun(null)
              go('documents')
            })
          }}
        >
          <Panel title="Контекст анализа">
            <div className="basis-options">
              {[
                [
                  'candidate',
                  'Поступление на государственную службу',
                  'Предварительная проверка представленных сведений.'
                ],
                ['expense_review', 'Сведения о расходах', 'Сопоставление имеющихся документов и источников.']
              ].map(([value, label, subtitle]) => (
                <label key={value} className={form.basis === value ? 'selected' : ''}>
                  <input
                    type="radio"
                    name="basis"
                    value={value}
                    checked={form.basis === value}
                    onChange={() => setForm({ ...form, basis: value })}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{subtitle}</small>
                  </span>
                </label>
              ))}
            </div>
          </Panel>
          <Panel title="Сведения о вымышленном лице">
            <label>
              Имя в демонстрационном комплекте
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Например, Иванов Алексей · вымышленное лицо"
                minLength={2}
                maxLength={200}
                required
              />
            </label>
            <div className="form-row">
              <label>
                Подразделение
                <input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  maxLength={200}
                  placeholder="Учебное подразделение"
                />
              </label>
              <label>
                Отчётный год
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                  required
                />
              </label>
            </div>
            <label className="checkbox">
              <input type="checkbox" required />
              Подтверждаю, что сведения полностью вымышленные.
            </label>
            <button disabled={busy} type="submit">
              Создать дело и перейти к документам <ArrowRight size={17} />
            </button>
          </Panel>
        </form>
        <div>
          <Notice>
            Выбранный контекст — упрощение для демо, не юридическое решение о наличии основания проверки.
          </Notice>
          <Panel title="Что появится в деле">
            <ul className="check-list">
              <li>
                Документы и извлечённые поля <Check size={16} />
              </li>
              <li>
                Объяснимые результаты <Check size={16} />
              </li>
              <li>
                Решения специалиста <Check size={16} />
              </li>
              <li>
                История запусков и действий <Check size={16} />
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  )
}

export function CaseView(m: AppModel) {
  const { detail, go } = m
  if (!detail) return null
  return (
    <>
      <Panel>
        <div className="person">
          <div className="avatar large">ДМ</div>
          <div>
            <small>Вымышленное проверяемое лицо</small>
            <h2>{detail.name}</h2>
            <p>
              {detail.department} · {basisText(detail.basis)}
            </p>
          </div>
          <Badge status={detail.status} />
        </div>
        <div className="info-grid">
          <div>
            <small>Номер дела</small>
            <strong>{detail.number}</strong>
          </div>
          <div>
            <small>Отчётный год</small>
            <strong>{detail.year}</strong>
          </div>
          <div>
            <small>Дата открытия</small>
            <strong>{dateText(detail.created_at)}</strong>
          </div>
        </div>
      </Panel>
      <div className="tabs">
        <button onClick={() => go('documents')}>Документы ({detail.documents.length})</button>
        <button onClick={() => go('analysis')}>Результаты ({detail.signals_count})</button>
        <button onClick={() => go('report')}>Рабочий итог</button>
      </div>
      <div className="columns">
        <Panel title="Сведения и источники">
          {detail.facts.slice(0, 8).map((f) => (
            <div className="key-value" key={f.id}>
              <span>
                {f.label}
                <small>{f.document_name}</small>
              </span>
              <strong>{displayValue(f)}</strong>
            </div>
          ))}
          {!detail.facts.length && <p>Сведения ещё не добавлены.</p>}
          <button className="link" onClick={() => go('documents')}>
            Все поля →
          </button>
        </Panel>
        <Panel title="История действий">
          <div className="timeline">
            {detail.events.map((e) => (
              <div key={e.id}>
                <small>
                  {dateText(e.created_at)} · {e.author}
                </small>
                <p className="event-text">{e.message}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  )
}

export function DocumentsView(m: AppModel) {
  const { cases, detail, busy, error, setToast, setEdit, filter, refresh, task, upload } = m
  if (!detail) return null
  return (
    <>
      <div className="steps">
        <b>
          <Check size={16} /> <span>Создание дела</span>
        </b>
        <i />
        <b>
          2 <span>Документы</span>
        </b>
        <i />
        <span>3 Анализ</span>
        <i />
        <span>4 Решение</span>
      </div>
      <Notice>
        Поддерживаются JSON/XLSX и текстовые PDF/DOCX по учебному шаблону. Произвольные справки БК, сканы и
        OCR пока не поддерживаются. Загрузка реально сохраняет файл на сервере.
      </Notice>
      <div className="columns docs-layout">
        <Panel title={`Документы (${detail.documents.length})`}>
          <div className="document-list">
            {detail.documents.map((d) => (
              <div className="document" key={d.id}>
                <span className="file-icon">
                  <Files size={22} />
                </span>
                <div>
                  <strong>{d.name}</strong>
                  <small>
                    {d.downloadable
                      ? 'Загружен на сервер'
                      : 'Встроенные синтетические факты · без исходного файла'}
                  </small>
                  {d.error && <p className="amber">{d.error}</p>}
                </div>
                {d.downloadable && (
                  <a
                    className="icon-button"
                    href={`/api/cases/${detail.id}/documents/${d.id}`}
                    aria-label={`Скачать ${d.name}`}
                  >
                    <Download size={17} />
                  </a>
                )}
              </div>
            ))}
          </div>
          <label
            className={`upload-zone ${busy ? 'disabled' : ''}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (!busy) upload(e.dataTransfer.files)
            }}
          >
            <Upload size={34} />
            <strong>Добавьте синтетический документ</strong>
            <span>JSON, XLSX, PDF, DOCX · до 5 МБ на файл</span>
            <span className="button secondary">Выбрать файл</span>
            <input
              aria-label="Загрузить документ"
              type="file"
              accept=".json,.xlsx,.pdf,.docx"
              multiple
              disabled={busy}
              onChange={(e) => {
                upload(e.target.files)
                e.target.value = ''
              }}
            />
          </label>
          {!detail.documents.length && (
            <div className="demo-buttons">
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  task(async () => {
                    await api(`/cases/${detail.id}/demo?kind=trade_in`, { method: 'POST' })
                    await refresh()
                  })
                }
              >
                Добавить учебный trade-in
              </button>
            </div>
          )}
        </Panel>
        <Panel title="Проверка извлечения">
          <div className="big-number">{detail.facts.length}</div>
          <p>полей из доступного комплекта</p>
          <div className="key-value">
            <span>Подтверждено</span>
            <strong>{detail.facts.filter((f) => f.confirmed).length}</strong>
          </div>
          <div className="key-value">
            <span>Нужна сверка</span>
            <strong>{detail.facts.filter((f) => !f.confirmed).length}</strong>
          </div>
          <Notice>
            Перед подтверждением сверьте значения, даты, единицы и связь с объектом. Кнопка подтверждает
            проверку специалистом, а не точность распознавания.
          </Notice>
          <button
            className="full"
            disabled={busy || !detail.facts.some((f) => !f.confirmed)}
            onClick={() => {
              if (window.confirm('Вы сверили ВСЕ поля с источниками? Подтверждение фиксируется в истории.'))
                task(async () => {
                  await api(`/cases/${detail.id}/confirm-facts`, { method: 'POST' })
                  await refresh()
                  setToast('Поля подтверждены. Можно запускать анализ.')
                })
            }}
          >
            <Check size={17} />
            Подтвердить все после сверки
          </button>
        </Panel>
      </div>
      <Panel title="Извлечённые сведения" action={<small>Нажмите «Уточнить» для исправления</small>}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ПОЛЕ / ИСТОЧНИК</th>
                <th>ОБЪЕКТ</th>
                <th>ЗНАЧЕНИЕ</th>
                <th>ДАТА</th>
                <th>СТАТУС</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {detail.facts.map((f) => (
                <tr key={f.id}>
                  <td>
                    <strong>{f.label}</strong>
                    <small>{f.document_name}</small>
                  </td>
                  <td>{f.object_id}</td>
                  <td>{displayValue(f)}</td>
                  <td>{f.date || 'Не указана'}</td>
                  <td>
                    <span className={`badge ${f.confirmed ? 'resolved' : 'unreviewed'}`}>
                      {f.confirmed ? 'Подтверждено' : 'Нужна сверка'}
                    </span>
                  </td>
                  <td>
                    <button className="link" onClick={() => setEdit(f)}>
                      Уточнить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!detail.facts.length && (
          <p className="muted">Загрузите поддерживаемый документ или добавьте учебный комплект.</p>
        )}
      </Panel>
    </>
  )
}

export function AnalysisView(m: AppModel) {
  const { detail, rules, setSignalId, setSelectedRun, filter, currentRun, archived, go, openSignal } = m
  if (!detail) return null
  return (
    <>
      {detail.runs.length > 0 && (
        <div className="run-selector">
          <label>
            Запуск анализа
            <select
              value={currentRun?.id || ''}
              onChange={(e) => {
                setSelectedRun(e.target.value)
                setSignalId(null)
              }}
            >
              {detail.runs.map((r, i) => (
                <option key={r.id} value={r.id}>
                  {i === 0 ? 'Последний' : 'Архивный'} · {dateText(r.created_at)} · {r.signals.length}{' '}
                  сигналов
                </option>
              ))}
            </select>
          </label>
          <small>
            Правила {currentRun?.rule_version} · {currentRun?.enabled_rules.length} включено
          </small>
        </div>
      )}
      {currentRun ? (
        <>
          <div className="summary-bar">
            <Check size={17} />
            Анализ выполнен · <b>{currentRun.signals.length} сигналов</b> ·{' '}
            {archived ? 'архивный снимок' : 'последний запуск'}
          </div>
          <div className="columns analysis-layout">
            <div>
              <div className="section-heading">
                <h2>Обнаруженные сигналы</h2>
                <small>{currentRun.signals.length} результатов</small>
              </div>
              {currentRun.signals.map((s) => (
                <section className="signal-card panel" key={s.id}>
                  <div>
                    <small>
                      {s.rule} · версия {currentRun.rule_version}
                    </small>
                    <Badge status={s.status} />
                  </div>
                  <h3>{s.title}</h3>
                  <p>{s.explanation}</p>
                  <footer>
                    <span className="source-tag">{s.evidence.length} значений-оснований</span>
                    <button className="link" onClick={() => openSignal(s)}>
                      Разобрать <ArrowRight size={15} />
                    </button>
                  </footer>
                </section>
              ))}
              {!currentRun.signals.length && (
                <Panel>
                  <div className="empty">
                    <ShieldCheck size={42} />
                    <h2>Сигналов по выбранным правилам нет</h2>
                    <p>
                      Это не доказывает полноту или достоверность всех сведений за пределами загруженного
                      комплекта и реализованных правил.
                    </p>
                  </div>
                </Panel>
              )}
            </div>
            <div>
              <Panel title="Сводка анализа">
                <div className="summary-numbers">
                  <div>
                    <b>{currentRun.signals.length}</b>
                    <small>Всего сигналов</small>
                  </div>
                  <div>
                    <b className="amber">
                      {currentRun.signals.filter((s) => s.status !== 'resolved').length}
                    </b>
                    <small>Не объяснены</small>
                  </div>
                </div>
                <div className="key-value">
                  <span>Документов сейчас</span>
                  <strong>{detail.documents.length}</strong>
                </div>
                <div className="key-value">
                  <span>Правил применено</span>
                  <strong>{currentRun.enabled_rules.length}</strong>
                </div>
                <button className="secondary full" onClick={() => go('report')}>
                  Рабочий итог <ArrowRight size={16} />
                </button>
                <button className="text-button" onClick={() => go('rules')}>
                  Настроить следующий запуск
                </button>
              </Panel>
              {currentRun.warnings.map((w) => (
                <Notice warning key={w}>
                  {w}
                </Notice>
              ))}
            </div>
          </div>
        </>
      ) : (
        <Panel>
          <div className="empty">
            <Activity size={38} />
            <h2>Анализ ещё не выполнялся</h2>
            <p>Добавьте сведения и подтвердите извлечение в разделе «Документы».</p>
            <button onClick={() => go('documents')}>Перейти к документам →</button>
          </div>
        </Panel>
      )}
    </>
  )
}

export function EvidenceView(m: AppModel) {
  const {
    detail,
    busy,
    setToast,
    comment,
    setComment,
    currentRun,
    currentSignal,
    archived,
    refresh,
    task,
    go
  } = m
  if (!detail) return null
  return currentSignal ? (
    <div className="columns evidence-layout">
      <div>
        <Panel>
          <div className="section-heading">
            <small>
              {currentSignal.rule} · версия {currentRun?.rule_version}
            </small>
            <Badge status={currentSignal.status} />
          </div>
          <h2>{currentSignal.title}</h2>
          <p>{currentSignal.explanation}</p>
          <h3>Сопоставление источников</h3>
          <div className="evidence-grid">
            {currentSignal.evidence.map((f, i) => (
              <article className="evidence-item" key={`${f.id}-${i}`}>
                <small>{f.document_name}</small>
                <strong>{displayValue(f)}</strong>
                <p>{f.label}</p>
                <div>
                  Объект: {f.object_id}
                  <br />
                  Дата: {f.date || 'не указана'}
                </div>
                <blockquote>{f.snippet}</blockquote>
              </article>
            ))}
          </div>
          <h3>Рекомендуемое действие</h3>
          <Notice>{currentSignal.action}</Notice>
          <button className="link" onClick={() => go('analysis')}>
            <ArrowLeft size={15} />
            Ко всем сигналам
          </button>
        </Panel>
        <Panel title="История решений">
          {currentSignal.decisions.length ? (
            currentSignal.decisions.map((d) => (
              <div className="decision" key={d.id}>
                <Badge status={d.status} />
                <small>
                  {dateText(d.created_at)} · {d.author}
                </small>
                <p>{d.comment}</p>
              </div>
            ))
          ) : (
            <p className="muted">Решение ещё не зафиксировано.</p>
          )}
        </Panel>
      </div>
      <div>
        <Panel title="Решение специалиста">
          <label>
            Комментарий к рассмотрению
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Укажите проверенные документы и основание решения…"
              minLength={5}
              maxLength={4000}
              rows={5}
            />
          </label>
          <small>Комментарий обязателен. Решение сохраняется на сервере.</small>
          {[
            ['clarification', 'Запросить дополнительные сведения'],
            ['resolved', 'Расхождение объяснено'],
            ['further_review', 'Передать на дальнейшее рассмотрение']
          ].map(([status, label]) => (
            <button
              className={`full ${status === 'resolved' ? '' : 'secondary'}`}
              key={status}
              disabled={busy || comment.trim().length < 5 || archived || detail.stale}
              onClick={() =>
                task(async () => {
                  await api(`/signals/${currentSignal.id}/decisions`, {
                    method: 'POST',
                    body: JSON.stringify({ status, comment })
                  })
                  await refresh()
                  setComment('')
                  setToast('Решение сохранено.')
                })
              }
            >
              {label}
            </button>
          ))}
        </Panel>
        <Notice warning>
          {archived
            ? 'Архивный запуск доступен только для просмотра.'
            : 'Уточнение регистрируется как действие. Реальной отправки запросов в ведомства нет.'}
        </Notice>
      </div>
    </div>
  ) : (
    <Panel>
      <div className="empty">
        <Target size={36} />
        <h2>Выберите сигнал</h2>
        <button onClick={() => go('analysis')}>Открыть результаты →</button>
      </div>
    </Panel>
  )
}

export function RulesView(m: AppModel) {
  const { detail, rules, enabled, setEnabled, busy, filter, analyzeCase } = m
  return (
    <>
      <Notice>
        Переключатели определяют правила следующего запуска. Старые результаты не переписываются. Для
        пересчёта выберите дело и нажмите «Запустить анализ».
      </Notice>
      <div className="rules-grid">
        {rules.map((r) => (
          <section className="panel rule-card" key={r.id}>
            <span className="rule-icon">
              <Diamond size={27} />
            </span>
            <div>
              <small>{r.id} · ДЕТЕРМИНИРОВАННОЕ ПРАВИЛО</small>
              <h3>{r.title}</h3>
              <p>{r.description}</p>
            </div>
            <button
              role="switch"
              aria-checked={enabled.includes(r.id)}
              aria-label={r.title}
              className={`toggle ${enabled.includes(r.id) ? 'on' : ''}`}
              onClick={() =>
                setEnabled((previous) =>
                  previous.includes(r.id) ? previous.filter((x) => x !== r.id) : [...previous, r.id]
                )
              }
            >
              <span />
            </button>
          </section>
        ))}
      </div>
      <Notice warning>
        Методические проверки прототипа не являются полным набором требований законодательства. Применимость к
        конкретной категории и основанию должна быть проверена экспертом.
      </Notice>
      {detail && (
        <button disabled={busy || !enabled.length} onClick={analyzeCase}>
          Выполнить новый анализ дела {detail.number} <ArrowRight size={16} />
        </button>
      )}
    </>
  )
}

export function ReportView(m: AppModel) {
  const { user, detail, comment } = m
  if (!detail) return null
  return (
    <article className="report panel">
      <div className="report-brand">
        <Diamond size={19} />
        <b>РЕЗОНАНС</b>
        <span>/ УЧЕБНЫЙ РАБОЧИЙ ДОКУМЕНТ</span>
      </div>
      <h1>Результаты предварительного анализа сведений</h1>
      <p>
        {detail.number} · отчётный год {detail.year}
      </p>
      <div className="info-grid">
        <div>
          <small>Вымышленное лицо</small>
          <strong>{detail.name}</strong>
        </div>
        <div>
          <small>Специалист</small>
          <strong>{user?.display_name || user?.username}</strong>
        </div>
        <div>
          <small>Контекст</small>
          <strong>{basisText(detail.basis)}</strong>
        </div>
      </div>
      {detail.stale && (
        <Notice warning>
          Неактуальный снимок: после запуска изменились сведения. Нужен повторный анализ.
        </Notice>
      )}
      <Notice>
        Сигнал не устанавливает нарушение. Это проект рабочего документа на синтетических данных, а не
        официальный акт проверки.
      </Notice>
      <h3>1. Последний запуск</h3>
      {detail.runs[0] ? (
        <>
          <p>
            {dateText(detail.runs[0].created_at)} · версия {detail.runs[0].rule_version} · включено правил:{' '}
            {detail.runs[0].enabled_rules.length}
          </p>
          <small className="hash">SHA-256 снимка: {detail.runs[0].input_hash}</small>
          <table>
            <thead>
              <tr>
                <th>КОД</th>
                <th>ПРЕДМЕТ РАССМОТРЕНИЯ</th>
                <th>СТАТУС</th>
              </tr>
            </thead>
            <tbody>
              {detail.runs[0].signals.map((s) => (
                <tr key={s.id}>
                  <td>{s.rule}</td>
                  <td>{s.title}</td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!detail.runs[0].signals.length && (
            <p>По выбранным правилам сигналов нет. Это не доказывает полноту всего комплекта.</p>
          )}
          <h3>2. Решения специалиста</h3>
          {detail.runs[0].signals.map((s) => (
            <div key={s.id}>
              <strong>
                {s.rule} · {s.title}
              </strong>
              {s.decisions.length ? (
                s.decisions.map((d) => (
                  <p key={d.id}>
                    {statusLabels[d.status]} · {d.author} · {dateText(d.created_at)}
                    <br />
                    {d.comment}
                  </p>
                ))
              ) : (
                <p className="muted">Не рассмотрено.</p>
              )}
            </div>
          ))}
        </>
      ) : (
        <p>Анализ ещё не выполнен.</p>
      )}
      <h3>3. Ограничения</h3>
      <p>
        Анализ ограничен подтверждёнными полями загруженного синтетического комплекта и выбранными правилами.
        Доступа к Госуслугам, банкам и ведомственным реестрам нет. Качество на реальных сведениях не
        установлено.
      </p>
      <footer>Резонанс · демонстрационный прототип · не для обработки реальных персональных данных</footer>
    </article>
  )
}
