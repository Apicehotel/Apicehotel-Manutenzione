import { useEffect, useMemo, useState } from 'react'
import { fetchIssues } from '../issues-data.js'
import { fetchUrgents } from '../urgents-data.js'
import { fetchPlanned } from '../planned-data.js'
import { fetchOperationalWeather } from '../weather-data.js'
import { Card, Icon, Spinner } from './ui.jsx'
import { firstName, can, isToday, URGENCY_META } from './helpers.js'

const MAX_ROWS = 3
const MAX_PER_ROW = 3
const MAX_WIDGETS = MAX_ROWS * MAX_PER_ROW
const WIDGET_IDS = ['issues', 'urgent', 'interventions', 'quick', 'weather']
const DEFAULT_ROWS = [['issues', 'urgent', 'interventions']]

const storageKey = (user, hotel) => `randapp.home.widgets.v4:${user?.id || user?.name || 'user'}:${hotel?.id || 'hotel'}`
const defaultLayout = () => ({ rows: DEFAULT_ROWS.map((row) => [...row]) })

const normalizeLayout = (raw) => {
  if (!raw || !Array.isArray(raw.rows)) return defaultLayout()
  const seen = new Set()
  const rows = raw.rows.slice(0, MAX_ROWS).map((row) => Array.isArray(row)
    ? row.filter((id) => WIDGET_IDS.includes(id) && !seen.has(id) && seen.add(id)).slice(0, MAX_PER_ROW)
    : []).filter((row) => row.length)
  return rows.length ? { rows } : defaultLayout()
}

const loadLayout = (user, hotel) => {
  try { return normalizeLayout(JSON.parse(localStorage.getItem(storageKey(user, hotel)) || 'null')) }
  catch { return defaultLayout() }
}

const saveLayout = (user, hotel, layout) => {
  try { localStorage.setItem(storageKey(user, hotel), JSON.stringify(layout)) } catch { /* Local storage opzionale. */ }
}

const flattenRows = (rows) => rows.flat().slice(0, MAX_WIDGETS)

export default function Home({ user, hotel, onNavigate, personalizeSignal = 0 }) {
  const [loading, setLoading] = useState(true)
  const [issues, setIssues] = useState([])
  const [urgents, setUrgents] = useState([])
  const [planned, setPlanned] = useState([])
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [editing, setEditing] = useState(false)
  const [layout, setLayout] = useState(() => loadLayout(user, hotel))
  const [draggedId, setDraggedId] = useState(null)

  useEffect(() => {
    setLayout(loadLayout(user, hotel))
    setEditing(false)
  }, [user?.id, user?.name, hotel.id])

  useEffect(() => { if (personalizeSignal > 0) setEditing(true) }, [personalizeSignal])
  useEffect(() => { saveLayout(user, hotel, layout) }, [layout, user?.id, user?.name, hotel.id])

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.allSettled([fetchIssues(hotel.id), fetchUrgents(hotel.id), fetchPlanned(hotel.id)]).then((res) => {
      if (!active) return
      setIssues(res[0].value?.issues || [])
      setUrgents(res[1].value?.items || [])
      setPlanned(res[2].value?.items || [])
      setLoading(false)
    })
    return () => { active = false }
  }, [hotel.id])

  const visibleIds = flattenRows(layout.rows)
  const weatherEnabled = visibleIds.includes('weather')
  useEffect(() => {
    if (!weatherEnabled) { setWeather(null); setWeatherError(''); return undefined }
    let active = true
    const controller = new AbortController()
    setWeather(null)
    setWeatherError('')
    fetchOperationalWeather(hotel.id, { signal: controller.signal })
      .then((data) => { if (active) setWeather(data) })
      .catch(() => { if (active) setWeatherError('Meteo non disponibile') })
    return () => { active = false; controller.abort() }
  }, [hotel.id, weatherEnabled])

  const openIssues = issues.filter((i) => i.status !== 'done')
  const openUrgents = urgents.filter((u) => u.status !== 'completata')
  const todayInterventions = planned.filter((p) => p.status !== 'done' && (isToday(p.scheduledAt) || (p.scheduledAt && p.scheduledUntil && p.scheduledAt <= Date.now() && p.scheduledUntil >= Date.now())))
  const recent = [...issues].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 4)

  const weatherVisual = weatherError
    ? { icon: '⚪', title: 'Meteo', message: weatherError, tone: 'muted' }
    : weather?.level === 'danger'
      ? { icon: '🌬️', title: 'ALLARME METEO', message: weather.message || 'Chiudere gli ombrelloni', tone: 'danger' }
      : weather?.level === 'warning'
        ? { icon: weather?.rainProbability >= 60 ? '🌧️' : '💨', title: 'Attenzione meteo', message: weather.message || 'Controllare gli esterni', tone: 'warning' }
        : { icon: '☀️', title: 'Meteo OK', message: 'Nessuna azione richiesta', tone: 'ok' }

  const widgets = useMemo(() => ({
    weather: { title: 'Meteo operativo', render: () => <Card className={`rs-home-widget__card rs-weather-tile rs-weather-tile--${weatherVisual.tone}`} data-testid="weather-widget"><span className="rs-weather-tile__icon">{weatherVisual.icon}</span><strong>{weatherVisual.title}</strong><span>{weatherVisual.message}</span></Card> },
    issues: { title: 'Segnalazioni aperte', render: () => <Card as="button" className="rs-stat rs-home-widget__card" onClick={() => !editing && onNavigate?.('issues')} data-testid="stat-issues"><span className="rs-stat__icon"><Icon name="issues" /></span><b className="rs-stat__count">{openIssues.length}</b><h3>Segnalazioni aperte</h3><p>{openIssues.length ? 'Da gestire' : 'Tutto in ordine'}</p></Card> },
    urgent: { title: 'Urgenti', render: () => <Card as="button" className="rs-stat rs-home-widget__card" onClick={() => !editing && onNavigate?.('urgent')} data-testid="stat-urgent"><span className="rs-stat__icon warn"><Icon name="warning" /></span><b className="rs-stat__count">{openUrgents.length}</b><h3>Urgenti</h3><p>{openUrgents.length ? 'Richiedono azione' : 'Nessun avviso'}</p></Card> },
    interventions: { title: 'Interventi oggi', render: () => <Card as="button" className="rs-stat rs-home-widget__card" onClick={() => !editing && onNavigate?.('interventions')} data-testid="stat-interventions"><span className="rs-stat__icon blue"><Icon name="wrench" /></span><b className="rs-stat__count">{todayInterventions.length}</b><h3>Interventi oggi</h3><p>Pianificati</p></Card> },
    quick: { title: 'Azioni rapide', render: () => <Card className="rs-card--pad rs-home-widget__card rs-home-widget__quick"><div className="rs-section__head"><h2>Azioni rapide</h2></div><div className="rs-quick">{can(user, 'create') && <button className="rs-quickbtn accent" onClick={() => onNavigate?.('issues')}><Icon name="plus" /> Nuova segnalazione</button>}<button className="rs-quickbtn" onClick={() => onNavigate?.('urgent')}><Icon name="warning" /> Urgenti</button><button className="rs-quickbtn" onClick={() => onNavigate?.('interventions')}><Icon name="wrench" /> Interventi</button></div></Card> },
  }), [editing, onNavigate, openIssues.length, openUrgents.length, todayInterventions.length, user, weatherVisual])

  const hiddenIds = WIDGET_IDS.filter((id) => !visibleIds.includes(id))

  const updateRows = (producer) => setLayout((current) => normalizeLayout({ rows: producer(current.rows.map((row) => [...row])) }))
  const hideWidget = (id) => updateRows((rows) => rows.map((row) => row.filter((item) => item !== id)).filter((row) => row.length))
  const showWidget = (id) => updateRows((rows) => {
    if (flattenRows(rows).length >= MAX_WIDGETS) return rows
    const last = rows[rows.length - 1]
    if (last && last.length < MAX_PER_ROW) last.push(id)
    else if (rows.length < MAX_ROWS) rows.push([id])
    return rows
  })

  const locate = (rows, id) => {
    for (let r = 0; r < rows.length; r += 1) {
      const c = rows[r].indexOf(id)
      if (c >= 0) return [r, c]
    }
    return [-1, -1]
  }

  const moveWidget = (id, direction) => updateRows((rows) => {
    const [r, c] = locate(rows, id)
    if (r < 0) return rows
    if (direction === 'left' && c > 0) [rows[r][c - 1], rows[r][c]] = [rows[r][c], rows[r][c - 1]]
    if (direction === 'right' && c < rows[r].length - 1) [rows[r][c + 1], rows[r][c]] = [rows[r][c], rows[r][c + 1]]
    if (direction === 'up' && r > 0 && rows[r - 1].length < MAX_PER_ROW) { rows[r].splice(c, 1); rows[r - 1].push(id) }
    if (direction === 'down' && r < MAX_ROWS - 1) {
      if (!rows[r + 1]) rows[r + 1] = []
      if (rows[r + 1].length < MAX_PER_ROW) { rows[r].splice(c, 1); rows[r + 1].push(id) }
    }
    return rows.filter((row) => row.length)
  })

  const dropOn = (targetId) => {
    if (!draggedId || draggedId === targetId) return
    updateRows((rows) => {
      const [sr, sc] = locate(rows, draggedId)
      const [tr, tc] = locate(rows, targetId)
      if (sr < 0 || tr < 0) return rows
      rows[sr][sc] = targetId
      rows[tr][tc] = draggedId
      return rows
    })
    setDraggedId(null)
  }

  return (
    <div data-testid="home-view" className={editing ? 'rs-home is-editing' : 'rs-home'}>
      <style>{`
        .rs-home-toolbar{display:flex;justify-content:flex-end;gap:8px;margin:0 0 12px}
        .rs-home-finish,.rs-home-reset,.rs-home-add{min-height:44px;border:1px solid var(--rs-border);border-radius:12px;background:var(--rs-surface);color:var(--rs-text);padding:9px 13px;font:inherit;font-weight:700}.rs-home-finish{background:var(--rs-accent);color:#fff;border-color:transparent}
        .rs-home-dashboard{display:flex;flex-direction:column;gap:clamp(8px,1.8vw,14px);width:100%}
        .rs-home-row{display:grid;grid-template-columns:repeat(var(--row-count),minmax(0,1fr));gap:clamp(8px,1.8vw,14px);width:100%;align-items:stretch}
        .rs-home-widget{position:relative;min-width:0;min-height:clamp(122px,18vw,170px)}
        .rs-home-widget>.rs-home-widget__card{width:100%;height:100%;min-height:inherit;margin:0;text-align:left;overflow:hidden}
        .rs-home-widget__controls{display:flex;flex-wrap:wrap;gap:4px;position:absolute;z-index:4;top:6px;right:6px;max-width:118px;justify-content:flex-end}
        .rs-home-widget__controls button{width:30px;height:30px;border-radius:9px;border:1px solid var(--rs-border);background:var(--rs-surface);color:var(--rs-text);font-size:15px;font-weight:800}.rs-home-widget__controls button:disabled{opacity:.3}.rs-home.is-editing .rs-home-widget__card{padding-top:42px;cursor:grab}.rs-home-widget.is-dragging{opacity:.55}
        .rs-home-catalog{margin-top:14px;padding:12px;border:1px dashed var(--rs-border);border-radius:14px}.rs-home-catalog h3{margin:0 0 5px;font-size:14px}.rs-home-catalog p{margin:0 0 10px;color:var(--rs-text-2);font-size:.82rem}.rs-home-catalog__list{display:flex;gap:8px;flex-wrap:wrap}
        .rs-home-activity{margin-top:clamp(14px,2.4vw,22px)}.rs-home-recent{width:100%;border:0;background:transparent;color:inherit;text-align:left}
        .rs-weather-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center!important;padding:clamp(10px,2vw,16px)!important}.rs-weather-tile__icon{font-size:clamp(1.7rem,5vw,2.5rem);line-height:1}.rs-weather-tile strong{font-size:clamp(.82rem,2.2vw,1.05rem)}.rs-weather-tile span:last-child{font-size:clamp(.66rem,1.8vw,.8rem);color:var(--rs-text-2);line-height:1.2}.rs-weather-tile--warning{box-shadow:inset 0 0 0 1px rgba(245,158,11,.6)}.rs-weather-tile--danger{box-shadow:inset 0 0 0 2px rgba(239,68,68,.75)}.rs-weather-tile--muted{opacity:.8}
        @media(max-width:520px){.rs-home-row{gap:8px}.rs-home-widget{min-height:118px}.rs-home-row[style*="--row-count: 3"] .rs-stat__icon{display:none}.rs-home-row[style*="--row-count: 3"] .rs-stat__count{font-size:1.45rem}.rs-home-row[style*="--row-count: 3"] .rs-stat h3{font-size:.72rem}.rs-home-row[style*="--row-count: 3"] .rs-stat p{display:none}}
      `}</style>

      <section className="rs-hero"><h1>Ciao, {firstName(user?.name)}</h1><p>{hotel.name} · ecco la situazione di oggi</p></section>

      {loading ? <Spinner label="Carico i dati della struttura…" /> : <>
        {editing && <div className="rs-home-toolbar"><button className="rs-home-reset" type="button" onClick={() => setLayout(defaultLayout())}>Ripristina</button><button className="rs-home-finish" type="button" onClick={() => setEditing(false)}>Fine</button></div>}

        <div className="rs-home-dashboard" data-testid="home-stats">
          {layout.rows.map((row, rowIndex) => <div className="rs-home-row" key={`row-${rowIndex}`} style={{ '--row-count': row.length }}>
            {row.map((id, colIndex) => <div className={`rs-home-widget${draggedId === id ? ' is-dragging' : ''}`} key={id} data-widget-id={id} draggable={editing} onDragStart={() => setDraggedId(id)} onDragOver={(e) => editing && e.preventDefault()} onDrop={() => dropOn(id)}>
              {editing && <div className="rs-home-widget__controls" aria-label={`Controlli ${widgets[id].title}`}>
                <button type="button" onClick={() => moveWidget(id, 'left')} disabled={colIndex === 0} aria-label="Sposta a sinistra">←</button>
                <button type="button" onClick={() => moveWidget(id, 'right')} disabled={colIndex === row.length - 1} aria-label="Sposta a destra">→</button>
                <button type="button" onClick={() => moveWidget(id, 'up')} disabled={rowIndex === 0 || layout.rows[rowIndex - 1]?.length >= MAX_PER_ROW} aria-label="Sposta sopra">↑</button>
                <button type="button" onClick={() => moveWidget(id, 'down')} disabled={rowIndex >= MAX_ROWS - 1 || layout.rows[rowIndex + 1]?.length >= MAX_PER_ROW} aria-label="Sposta sotto">↓</button>
                <button type="button" onClick={() => hideWidget(id)} aria-label={`Nascondi ${widgets[id].title}`}>×</button>
              </div>}
              {widgets[id].render()}
            </div>)}
          </div>)}
        </div>

        {editing && <div className="rs-home-catalog"><h3>Widget disponibili</h3><p>Fino a 3 widget per riga e 3 righe. Puoi creare liberamente disposizioni 3/2/1, 2/2, 1/3/2 e altre combinazioni.</p>{hiddenIds.length ? <div className="rs-home-catalog__list">{hiddenIds.map((id) => <button key={id} className="rs-home-add" type="button" onClick={() => showWidget(id)} disabled={visibleIds.length >= MAX_WIDGETS}>+ {widgets[id].title}</button>)}</div> : <p>Tutti i widget disponibili sono già nella Home.</p>}</div>}

        <Card className="rs-card--pad rs-home-activity"><div className="rs-section__head"><h2>Attività recenti</h2></div>{recent.length === 0 ? <p style={{ margin: 0, color: 'var(--rs-text-2)' }}>Nessuna segnalazione registrata.</p> : <div className="rs-list">{recent.map((issue) => <button key={issue.id} className="rs-issue rs-home-recent" onClick={() => onNavigate?.('issues')}><span className={`rs-issue__accent ${URGENCY_META[issue.urgency]?.tone || 'mid'}`} /><span className="rs-issue__main"><span className="rs-issue__room">{issue.room}</span><span className="rs-issue__title">{issue.title}</span></span></button>)}</div>}</Card>
      </>}
    </div>
  )
}
