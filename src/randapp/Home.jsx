import { useEffect, useMemo, useState } from 'react'
import { fetchIssues } from '../issues-data.js'
import { fetchUrgents } from '../urgents-data.js'
import { fetchPlanned } from '../planned-data.js'
import { fetchOperationalWeather } from '../weather-data.js'
import { Card, Icon, Spinner } from './ui.jsx'
import { firstName, can, isToday, URGENCY_META } from './helpers.js'

const MAX_WIDGETS = 9
const DEFAULT_WIDGET_ORDER = ['issues', 'urgent', 'interventions', 'quick', 'recent', 'weather']
const DEFAULT_HIDDEN = ['weather']

const storageKey = (user, hotel) => `randapp.home.widgets.v1:${user?.id || user?.name || 'user'}:${hotel?.id || 'hotel'}`

const loadLayout = (user, hotel) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(user, hotel)) || 'null')
    if (!parsed || !Array.isArray(parsed.order) || !Array.isArray(parsed.hidden)) return { order: DEFAULT_WIDGET_ORDER, hidden: DEFAULT_HIDDEN }
    const known = new Set(DEFAULT_WIDGET_ORDER)
    const order = [...parsed.order.filter((id) => known.has(id)), ...DEFAULT_WIDGET_ORDER.filter((id) => !parsed.order.includes(id))]
    return { order: order.slice(0, MAX_WIDGETS), hidden: parsed.hidden.filter((id) => known.has(id)) }
  } catch {
    return { order: DEFAULT_WIDGET_ORDER, hidden: DEFAULT_HIDDEN }
  }
}

const saveLayout = (user, hotel, layout) => {
  try { localStorage.setItem(storageKey(user, hotel), JSON.stringify(layout)) } catch { /* La Home resta utilizzabile anche senza storage locale. */ }
}

const columnsFor = (count) => {
  if (count <= 1) return 1
  if (count <= 3) return count
  if (count <= 6) return 2
  return 3
}

export default function Home({ user, hotel, onNavigate }) {
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
    saveLayout(user, hotel, layout)
  }, [layout, user?.id, user?.name, hotel.id])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setLoading(true)
    setWeather(null)
    setWeatherError('')
    Promise.allSettled([
      fetchIssues(hotel.id),
      fetchUrgents(hotel.id),
      fetchPlanned(hotel.id),
      fetchOperationalWeather(hotel.id, { signal: controller.signal }),
    ]).then((res) => {
      if (!active) return
      setIssues(res[0].value?.issues || [])
      setUrgents(res[1].value?.items || [])
      setPlanned(res[2].value?.items || [])
      if (res[3].status === 'fulfilled') setWeather(res[3].value)
      else setWeatherError('Meteo non disponibile')
      setLoading(false)
    })
    return () => { active = false; controller.abort() }
  }, [hotel.id])

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
      render: () => <Card className="rs-card--pad rs-home-widget__card rs-home-widget__quick"><div className="rs-section__head"><h2>Azioni rapide</h2></div><div className="rs-quick">{can(user, 'create') && <button className="rs-quickbtn accent" onClick={() => onNavigate?.('issues')} data-testid="quick-new-issue"><Icon name="plus" /> Nuova segnalazione</button>}<button className="rs-quickbtn" onClick={() => onNavigate?.('issues')} data-testid="quick-open-issues"><Icon name="issues" /> Segnalazioni</button><button className="rs-quickbtn" onClick={() => onNavigate?.('urgent')} data-testid="quick-urgent"><Icon name="warning" /> Urgenti</button><button className="rs-quickbtn" onClick={() => onNavigate?.('interventions')} data-testid="quick-planning"><Icon name="wrench" /> Interventi</button></div></Card>,
    },
    recent: {
      title: 'Attività recenti',
      render: () => <Card className="rs-card--pad rs-home-widget__card rs-home-widget__recent"><div className="rs-section__head"><h2>Attività recenti</h2>{recent.length > 0 && <button onClick={() => onNavigate?.('issues')}>Tutte</button>}</div>{recent.length === 0 ? <p style={{ margin: 0, color: 'var(--rs-text-2)' }}>Nessuna segnalazione registrata per {hotel.name}.</p> : <div className="rs-list">{recent.map((issue) => <button key={issue.id} className="rs-issue rs-home-recent" onClick={() => onNavigate?.('issues')} data-testid={`recent-${issue.id}`}><span className={`rs-issue__accent ${URGENCY_META[issue.urgency]?.tone || 'mid'}`} /><span className="rs-issue__main"><span className="rs-issue__top"><span className="rs-issue__room">{issue.room}</span></span><span className="rs-issue__title">{issue.title}</span><span className="rs-issue__meta"><span><Icon name="clock" /> {issue.date}</span>{issue.category && <span>· {issue.category}</span>}</span></span></button>)}</div>}</Card>,
    },
  }), [editing, hotel.name, onNavigate, openIssues.length, openUrgents.length, recent, todayInterventions.length, user, weatherVisual])

  const visibleIds = layout.order.filter((id) => !layout.hidden.includes(id)).slice(0, MAX_WIDGETS)
  const hiddenIds = DEFAULT_WIDGET_ORDER.filter((id) => layout.hidden.includes(id))
  const columns = columnsFor(visibleIds.length)

  const hideWidget = (id) => setLayout((current) => ({ ...current, hidden: [...new Set([...current.hidden, id])] }))
  const showWidget = (id) => setLayout((current) => ({ ...current, hidden: current.hidden.filter((item) => item !== id) }))
  const moveWidget = (id, delta) => setLayout((current) => {
    const order = [...current.order]
    const index = order.indexOf(id)
    const next = index + delta
    if (index < 0 || next < 0 || next >= order.length) return current
    ;[order[index], order[next]] = [order[next], order[index]]
    return { ...current, order }
  })
  const resetLayout = () => setLayout({ order: DEFAULT_WIDGET_ORDER, hidden: DEFAULT_HIDDEN })

  return (
    <div data-testid="home-view" className={editing ? 'rs-home is-editing' : 'rs-home'}>
      <style>{`
        .rs-home-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin:0 0 12px;flex-wrap:wrap}
        .rs-home-edit,.rs-home-reset,.rs-home-add{min-height:44px;border:1px solid var(--rs-border);border-radius:12px;background:var(--rs-surface);color:var(--rs-text);padding:9px 13px;font:inherit;font-weight:700}
        .rs-home-edit{background:var(--rs-accent);color:#fff;border-color:transparent}
        .rs-home-grid{display:grid;grid-template-columns:repeat(var(--home-cols),minmax(0,1fr));gap:12px;align-items:stretch}
        .rs-home-widget{position:relative;min-width:0}
        .rs-home-widget>.rs-home-widget__card{width:100%;height:100%;min-height:150px;margin:0;text-align:left}
        .rs-home-widget__controls{display:flex;gap:6px;position:absolute;z-index:4;top:8px;right:8px}
        .rs-home-widget__controls button{width:38px;height:38px;border-radius:10px;border:1px solid var(--rs-border);background:var(--rs-surface);color:var(--rs-text);font-size:18px;font-weight:800}
        .rs-home.is-editing .rs-home-widget__card{padding-top:54px;cursor:default}
        .rs-home-hidden{margin-top:14px;padding:12px;border:1px dashed var(--rs-border);border-radius:14px}
        .rs-home-hidden h3{margin:0 0 9px;font-size:14px}
        .rs-home-hidden__list{display:flex;gap:8px;flex-wrap:wrap}
        .rs-home-recent{width:100%;border:0;background:transparent;color:inherit;text-align:left}
        .rs-home-widget__recent .rs-list{margin-top:8px}
        .rs-home-widget__quick .rs-quick{margin-top:10px}
        .rs-weather-tile{aspect-ratio:1/1;min-height:0!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;text-align:center!important;padding:14px!important;overflow:hidden}
        .rs-weather-tile__icon{font-size:2.2rem;line-height:1}
        .rs-weather-tile strong{font-size:1rem}
        .rs-weather-tile span:last-child{font-size:.78rem;color:var(--rs-text-2);line-height:1.25}
        .rs-weather-tile--warning{box-shadow:inset 0 0 0 1px rgba(245,158,11,.6)}
        .rs-weather-tile--danger{box-shadow:inset 0 0 0 2px rgba(239,68,68,.75)}
        .rs-weather-tile--muted{opacity:.8}
        @media (max-width:720px){.rs-home-grid{gap:8px}.rs-home-widget>.rs-home-widget__card{min-height:132px;padding-left:12px;padding-right:12px}.rs-home-grid[style*="--home-cols:3"] .rs-stat__icon{transform:scale(.85);transform-origin:left top}.rs-home-grid[style*="--home-cols:3"] .rs-stat__count{font-size:1.7rem}.rs-home-grid[style*="--home-cols:3"] .rs-stat h3{font-size:.84rem}.rs-home-grid[style*="--home-cols:3"] .rs-stat p{font-size:.72rem}.rs-weather-tile__icon{font-size:1.8rem}}
        @media (max-width:390px){.rs-home-grid{gap:6px}.rs-home-widget>.rs-home-widget__card{min-height:122px}.rs-home-grid[style*="--home-cols:3"] .rs-stat__icon{display:none}.rs-home-grid[style*="--home-cols:3"] .rs-stat__count{font-size:1.5rem}.rs-home-grid[style*="--home-cols:3"] .rs-stat h3{font-size:.76rem}.rs-home-grid[style*="--home-cols:3"] .rs-stat p{display:none}.rs-weather-tile strong{font-size:.84rem}.rs-weather-tile span:last-child{font-size:.7rem}}
      `}</style>

      <section className="rs-hero">
        <h1>Ciao, {firstName(user?.name)}</h1>
        <p>{hotel.name} · ecco la situazione di oggi</p>
      </section>

      {loading ? <Spinner label="Carico i dati della struttura…" /> : (
        <>
          <div className="rs-home-toolbar">
            {editing && <button className="rs-home-reset" type="button" onClick={resetLayout}>Ripristina</button>}
            <button className="rs-home-edit" type="button" onClick={() => setEditing((value) => !value)} aria-pressed={editing}>{editing ? 'Fine' : 'Personalizza Home'}</button>
          </div>

          <div className="rs-home-grid" style={{ '--home-cols': columns }} data-testid="home-stats">
            {visibleIds.map((id, index) => (
              <div className="rs-home-widget" key={id} data-widget-id={id}>
                {editing && <div className="rs-home-widget__controls" aria-label={`Controlli ${widgets[id].title}`}><button type="button" onClick={() => moveWidget(id, -1)} disabled={index === 0} aria-label="Sposta prima">‹</button><button type="button" onClick={() => moveWidget(id, 1)} disabled={index === visibleIds.length - 1} aria-label="Sposta dopo">›</button><button type="button" onClick={() => hideWidget(id)} aria-label={`Nascondi ${widgets[id].title}`}>×</button></div>}
                {widgets[id].render()}
              </div>
            ))}
          </div>

          {editing && <div className="rs-home-hidden"><h3>Widget disponibili</h3>{hiddenIds.length ? <div className="rs-home-hidden__list">{hiddenIds.map((id) => <button key={id} className="rs-home-add" type="button" onClick={() => showWidget(id)} disabled={visibleIds.length >= MAX_WIDGETS}>+ {widgets[id].title}</button>)}</div> : <p style={{ margin: 0, color: 'var(--rs-text-2)' }}>Tutti i widget sono già nella Home. Massimo 9: 3 colonne × 3 righe.</p>}</div>}
        </>
      )}
    </div>
  )
}
