import { useEffect, useMemo, useState } from 'react'
import { fetchIssues } from '../issues-data.js'
import { fetchUrgents } from '../urgents-data.js'
import { fetchPlanned } from '../planned-data.js'
import { fetchOperationalWeather } from '../weather-data.js'
import { Card, Icon, Spinner } from './ui.jsx'
import { firstName, can, isToday, URGENCY_META } from './helpers.js'

const MAX_WIDGETS = 3
const DEFAULT_WIDGET_ORDER = ['issues', 'urgent', 'interventions', 'quick', 'weather']
const DEFAULT_HIDDEN = ['quick', 'weather']
const defaultLayout = () => ({ order: [...DEFAULT_WIDGET_ORDER], hidden: [...DEFAULT_HIDDEN] })

const storageKey = (user, hotel) => `randapp.home.widgets.v3:${user?.id || user?.name || 'user'}:${hotel?.id || 'hotel'}`

const normalizeLayout = (raw) => {
  if (!raw || !Array.isArray(raw.order) || !Array.isArray(raw.hidden)) return defaultLayout()
  const known = new Set(DEFAULT_WIDGET_ORDER)
  const order = [...raw.order.filter((id) => known.has(id)), ...DEFAULT_WIDGET_ORDER.filter((id) => !raw.order.includes(id))]
  const hidden = new Set(raw.hidden.filter((id) => known.has(id)))
  const visible = order.filter((id) => !hidden.has(id))
  if (!visible.length) return defaultLayout()
  visible.slice(MAX_WIDGETS).forEach((id) => hidden.add(id))
  return { order, hidden: [...hidden] }
}

const loadLayout = (user, hotel) => {
  try {
    return normalizeLayout(JSON.parse(localStorage.getItem(storageKey(user, hotel)) || 'null'))
  } catch {
    return defaultLayout()
  }
}

const saveLayout = (user, hotel, layout) => {
  try { localStorage.setItem(storageKey(user, hotel), JSON.stringify(layout)) } catch { /* La Home resta utilizzabile anche senza storage locale. */ }
}

const columnsFor = (count) => Math.max(1, Math.min(MAX_WIDGETS, count))

export default function Home({ user, hotel, onNavigate, personalizeSignal = 0 }) {
  const [loading, setLoading] = useState(true)
  const [issues, setIssues] = useState([])
  const [urgents, setUrgents] = useState([])
  const [planned, setPlanned] = useState([])
  const [weather, setWeather] = useState(null)
  const [weatherError, setWeatherError] = useState('')
  const [editing, setEditing] = useState(false)
  const [layout, setLayout] = useState(() => loadLayout(user, hotel))

  useEffect(() => {
    setLayout(loadLayout(user, hotel))
    setEditing(false)
  }, [user?.id, user?.name, hotel.id])

  useEffect(() => {
    if (personalizeSignal > 0) setEditing(true)
  }, [personalizeSignal])

  useEffect(() => {
    saveLayout(user, hotel, layout)
  }, [layout, user?.id, user?.name, hotel.id])

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

  const weatherEnabled = !layout.hidden.includes('weather')
  useEffect(() => {
    if (!weatherEnabled) {
      setWeather(null)
      setWeatherError('')
      return undefined
    }
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
    weather: {
      title: 'Meteo operativo',
      render: () => <Card className={`rs-home-widget__card rs-weather-tile rs-weather-tile--${weatherVisual.tone}`} data-testid="weather-widget"><span className="rs-weather-tile__icon">{weatherVisual.icon}</span><strong>{weatherVisual.title}</strong><span>{weatherVisual.message}</span></Card>,
    },
    issues: {
      title: 'Segnalazioni aperte',
      render: () => <Card as="button" className="rs-stat rs-home-widget__card" onClick={() => !editing && onNavigate?.('issues')} data-testid="stat-issues"><span className="rs-stat__icon"><Icon name="issues" /></span><b className="rs-stat__count">{openIssues.length}</b><h3>Segnalazioni aperte</h3><p>{openIssues.length ? 'Da gestire' : 'Tutto in ordine'}</p></Card>,
    },
    urgent: {
      title: 'Urgenti',
      render: () => <Card as="button" className="rs-stat rs-home-widget__card" onClick={() => !editing && onNavigate?.('urgent')} data-testid="stat-urgent"><span className="rs-stat__icon warn"><Icon name="warning" /></span><b className="rs-stat__count">{openUrgents.length}</b><h3>Urgenti</h3><p>{openUrgents.length ? 'Richiedono azione' : 'Nessun avviso'}</p></Card>,
    },
    interventions: {
      title: 'Interventi oggi',
      render: () => <Card as="button" className="rs-stat rs-home-widget__card" onClick={() => !editing && onNavigate?.('interventions')} data-testid="stat-interventions"><span className="rs-stat__icon blue"><Icon name="wrench" /></span><b className="rs-stat__count">{todayInterventions.length}</b><h3>Interventi oggi</h3><p>Pianificati</p></Card>,
    },
    quick: {
      title: 'Azioni rapide',
      render: () => <Card className="rs-card--pad rs-home-widget__card rs-home-widget__quick"><div className="rs-section__head"><h2>Azioni rapide</h2></div><div className="rs-quick">{can(user, 'create') && <button className="rs-quickbtn accent" onClick={() => onNavigate?.('issues')} data-testid="quick-new-issue"><Icon name="plus" /> Nuova segnalazione</button>}<button className="rs-quickbtn" onClick={() => onNavigate?.('urgent')}><Icon name="warning" /> Urgenti</button><button className="rs-quickbtn" onClick={() => onNavigate?.('interventions')}><Icon name="wrench" /> Interventi</button></div></Card>,
    },
  }), [editing, onNavigate, openIssues.length, openUrgents.length, todayInterventions.length, user, weatherVisual])

  const visibleIds = layout.order.filter((id) => !layout.hidden.includes(id)).slice(0, MAX_WIDGETS)
  const hiddenIds = DEFAULT_WIDGET_ORDER.filter((id) => layout.hidden.includes(id))
  const columns = columnsFor(visibleIds.length)

  const hideWidget = (id) => setLayout((current) => {
    const visible = current.order.filter((item) => !current.hidden.includes(item))
    if (visible.length <= 1) return current
    return { ...current, hidden: [...new Set([...current.hidden, id])] }
  })

  const showWidget = (id) => setLayout((current) => {
    const visible = current.order.filter((item) => !current.hidden.includes(item))
    if (visible.length >= MAX_WIDGETS) return current
    return { ...current, hidden: current.hidden.filter((item) => item !== id) }
  })

  const moveWidget = (id, delta) => setLayout((current) => {
    const visible = current.order.filter((item) => !current.hidden.includes(item)).slice(0, MAX_WIDGETS)
    const visibleIndex = visible.indexOf(id)
    const targetId = visible[visibleIndex + delta]
    if (visibleIndex < 0 || !targetId) return current
    const order = [...current.order]
    const a = order.indexOf(id)
    const b = order.indexOf(targetId)
    ;[order[a], order[b]] = [order[b], order[a]]
    return { ...current, order }
  })

  const resetLayout = () => setLayout(defaultLayout())

  return (
    <div data-testid="home-view" className={editing ? 'rs-home is-editing' : 'rs-home'}>
      <style>{`
        .rs-home-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:0 0 12px}
        .rs-home-finish,.rs-home-reset,.rs-home-add{min-height:44px;border:1px solid var(--rs-border);border-radius:12px;background:var(--rs-surface);color:var(--rs-text);padding:9px 13px;font:inherit;font-weight:700}
        .rs-home-finish{background:var(--rs-accent);color:#fff;border-color:transparent}
        .rs-home-grid{display:grid;grid-template-columns:repeat(var(--home-cols),minmax(0,150px));gap:12px;align-items:stretch;justify-content:start;width:fit-content;max-width:100%}
        .rs-home-widget{position:relative;min-width:0;width:min(150px,100%);aspect-ratio:1/1}
        .rs-home-widget>.rs-home-widget__card{width:100%;height:100%;min-height:0;margin:0;text-align:left;overflow:hidden}
        .rs-home-widget__controls{display:flex;gap:4px;position:absolute;z-index:4;top:6px;right:6px}
        .rs-home-widget__controls button{width:32px;height:32px;border-radius:9px;border:1px solid var(--rs-border);background:var(--rs-surface);color:var(--rs-text);font-size:17px;font-weight:800}
        .rs-home-widget__controls button:disabled{opacity:.35}
        .rs-home.is-editing .rs-home-widget__card{padding-top:44px;cursor:default}
        .rs-home-catalog{margin-top:14px;padding:12px;border:1px dashed var(--rs-border);border-radius:14px}
        .rs-home-catalog h3{margin:0 0 5px;font-size:14px}
        .rs-home-catalog p{margin:0 0 10px;color:var(--rs-text-2);font-size:.82rem}
        .rs-home-catalog__list{display:flex;gap:8px;flex-wrap:wrap}
        .rs-home-activity{margin-top:16px}
        .rs-home-recent{width:100%;border:0;background:transparent;color:inherit;text-align:left}
        .rs-weather-tile{aspect-ratio:1/1;min-height:0!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center!important;padding:12px!important;overflow:hidden}
        .rs-weather-tile__icon{font-size:2rem;line-height:1}
        .rs-weather-tile strong{font-size:.9rem}
        .rs-weather-tile span:last-child{font-size:.7rem;color:var(--rs-text-2);line-height:1.2}
        .rs-weather-tile--warning{box-shadow:inset 0 0 0 1px rgba(245,158,11,.6)}
        .rs-weather-tile--danger{box-shadow:inset 0 0 0 2px rgba(239,68,68,.75)}
        .rs-weather-tile--muted{opacity:.8}
        @media (max-width:520px){.rs-home-grid{grid-template-columns:repeat(var(--home-cols),minmax(0,1fr));width:100%;gap:8px}.rs-home-widget{width:100%;max-width:150px}.rs-home-widget>.rs-home-widget__card{padding-left:9px;padding-right:9px}.rs-home-grid[style*="--home-cols:3"] .rs-stat__icon{transform:scale(.78);transform-origin:left top}.rs-home-grid[style*="--home-cols:3"] .rs-stat__count{font-size:1.5rem}.rs-home-grid[style*="--home-cols:3"] .rs-stat h3{font-size:.76rem}.rs-home-grid[style*="--home-cols:3"] .rs-stat p{font-size:.66rem}.rs-weather-tile__icon{font-size:1.7rem}}
        @media (max-width:390px){.rs-home-grid{gap:6px}.rs-home-grid[style*="--home-cols:3"] .rs-stat__icon{display:none}.rs-home-grid[style*="--home-cols:3"] .rs-stat__count{font-size:1.35rem}.rs-home-grid[style*="--home-cols:3"] .rs-stat h3{font-size:.69rem}.rs-home-grid[style*="--home-cols:3"] .rs-stat p{display:none}.rs-weather-tile strong{font-size:.74rem}.rs-weather-tile span:last-child{font-size:.61rem}}
      `}</style>

      <section className="rs-hero">
        <h1>Ciao, {firstName(user?.name)}</h1>
        <p>{hotel.name} · ecco la situazione di oggi</p>
      </section>

      {loading ? <Spinner label="Carico i dati della struttura…" /> : (
        <>
          {editing && <div className="rs-home-toolbar"><button className="rs-home-reset" type="button" onClick={resetLayout}>Ripristina</button><button className="rs-home-finish" type="button" onClick={() => setEditing(false)}>Fine</button></div>}

          <div className="rs-home-grid" style={{ '--home-cols': columns }} data-testid="home-stats">
            {visibleIds.map((id, index) => (
              <div className="rs-home-widget" key={id} data-widget-id={id}>
                {editing && <div className="rs-home-widget__controls" aria-label={`Controlli ${widgets[id].title}`}><button type="button" onClick={() => moveWidget(id, -1)} disabled={index === 0} aria-label="Sposta prima">‹</button><button type="button" onClick={() => moveWidget(id, 1)} disabled={index === visibleIds.length - 1} aria-label="Sposta dopo">›</button><button type="button" onClick={() => hideWidget(id)} disabled={visibleIds.length <= 1} aria-label={`Nascondi ${widgets[id].title}`}>×</button></div>}
                {widgets[id].render()}
              </div>
            ))}
          </div>

          {editing && <div className="rs-home-catalog"><h3>Widget disponibili</h3><p>Massimo 3 widget. Ogni riquadro arriva fino a 150 × 150 px e si restringe sui telefoni piccoli.</p>{hiddenIds.length ? <div className="rs-home-catalog__list">{hiddenIds.map((id) => <button key={id} className="rs-home-add" type="button" onClick={() => showWidget(id)} disabled={visibleIds.length >= MAX_WIDGETS}>+ {widgets[id].title}</button>)}</div> : <p>Tutti i widget disponibili sono già nella Home.</p>}</div>}

          <Card className="rs-card--pad rs-home-activity"><div className="rs-section__head"><h2>Attività recenti</h2></div>{recent.length === 0 ? <p style={{ margin: 0, color: 'var(--rs-text-2)' }}>Nessuna segnalazione registrata.</p> : <div className="rs-list">{recent.map((issue) => <button key={issue.id} className="rs-issue rs-home-recent" onClick={() => onNavigate?.('issues')}><span className={`rs-issue__accent ${URGENCY_META[issue.urgency]?.tone || 'mid'}`} /><span className="rs-issue__main"><span className="rs-issue__room">{issue.room}</span><span className="rs-issue__title">{issue.title}</span></span></button>)}</div>}</Card>
        </>
      )}
    </div>
  )
}
