import { useEffect, useMemo, useState } from 'react'
import ReactGridLayout, { useContainerWidth, verticalCompactor } from 'react-grid-layout'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import { z } from 'zod'
import {
  AlertTriangle,
  ClipboardList,
  CloudSun,
  GripVertical,
  LayoutGrid,
  Plus,
  RotateCcw,
  Wrench,
  X,
} from 'lucide-react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { fetchIssues } from '../issues-data.js'
import { fetchUrgents } from '../urgents-data.js'
import { fetchPlanned } from '../planned-data.js'
import { fetchOperationalWeather } from '../weather-data.js'
import { Card, Spinner } from './ui.jsx'
import { firstName, can, isToday, URGENCY_META } from './helpers.js'

const COLS = 3
const MAX_ROWS = 3
const WIDGET_IDS = ['issues', 'urgent', 'interventions', 'weather', 'quick']
const WIDGET_TITLES = {
  issues: 'Segnalazioni aperte',
  urgent: 'Urgenti',
  interventions: 'Interventi oggi',
  weather: 'Meteo operativo',
  quick: 'Azioni rapide',
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const LayoutItemSchema = z.object({
  i: z.enum(WIDGET_IDS),
  x: z.number().int().min(0).max(COLS - 1),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(COLS),
  h: z.number().int().min(1).max(2),
}).passthrough()

const SavedLayoutSchema = z.object({
  version: z.literal(5),
  layout: z.array(LayoutItemSchema).max(9),
})

const item = (i, x, y, w = 1, h = 1) => ({
  i,
  x,
  y,
  w,
  h,
  minW: 1,
  maxW: 3,
  minH: 1,
  maxH: 2,
})

const defaultLayout = () => [
  item('issues', 0, 0),
  item('urgent', 1, 0),
  item('interventions', 2, 0),
  item('weather', 0, 1),
  item('quick', 1, 1, 2),
]

const normalizeLayout = (value) => {
  const parsed = z.array(LayoutItemSchema).safeParse(value)
  if (!parsed.success || parsed.data.length === 0) return defaultLayout()
  const seen = new Set()
  return parsed.data
    .filter((entry) => !seen.has(entry.i) && seen.add(entry.i))
    .map((entry) => ({
      ...entry,
      x: Math.min(entry.x, COLS - entry.w),
      minW: 1,
      maxW: 3,
      minH: 1,
      maxH: 2,
    }))
}

const loadStoredLayout = (key) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return defaultLayout()
    const parsed = SavedLayoutSchema.safeParse(JSON.parse(raw))
    return parsed.success ? normalizeLayout(parsed.data.layout) : defaultLayout()
  } catch {
    return defaultLayout()
  }
}

const saveStoredLayout = (key, layout) => {
  try {
    localStorage.setItem(key, JSON.stringify({ version: 5, layout: normalizeLayout(layout) }))
  } catch {
    // La Home resta utilizzabile anche con storage locale non disponibile.
  }
}

const useWidgetStore = create((set, get) => ({
  storageKey: '',
  layout: defaultLayout(),
  hydrate: (storageKey) => {
    const layout = loadStoredLayout(storageKey)
    set({ storageKey, layout })
  },
  setLayout: (next) => {
    const layout = normalizeLayout(typeof next === 'function' ? next(get().layout) : next)
    set({ layout })
    if (get().storageKey) saveStoredLayout(get().storageKey, layout)
  },
  reset: () => {
    const layout = defaultLayout()
    set({ layout })
    if (get().storageKey) saveStoredLayout(get().storageKey, layout)
  },
}))

const useDeviceClass = () => {
  const classify = () => {
    if (typeof window === 'undefined') return 'desktop'
    if (window.innerWidth < 600) return 'phone'
    if (window.innerWidth < 1024) return 'tablet'
    return 'desktop'
  }
  const [deviceClass, setDeviceClass] = useState(classify)
  useEffect(() => {
    const onResize = () => setDeviceClass(classify())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return deviceClass
}

const sizeName = (w) => (w <= 1 ? 'S' : w === 2 ? 'M' : 'L')

function HomeData({ user, hotel, onNavigate, personalizeSignal }) {
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (personalizeSignal > 0) setEditing(true)
  }, [personalizeSignal])

  const issuesQuery = useQuery({
    queryKey: ['home', hotel.id, 'issues'],
    queryFn: () => fetchIssues(hotel.id),
  })
  const urgentsQuery = useQuery({
    queryKey: ['home', hotel.id, 'urgents'],
    queryFn: () => fetchUrgents(hotel.id),
  })
  const plannedQuery = useQuery({
    queryKey: ['home', hotel.id, 'planned'],
    queryFn: () => fetchPlanned(hotel.id),
  })
  const weatherQuery = useQuery({
    queryKey: ['home', hotel.id, 'weather'],
    queryFn: ({ signal }) => fetchOperationalWeather(hotel.id, { signal }),
    refetchInterval: 5 * 60_000,
  })

  const loading = issuesQuery.isPending || urgentsQuery.isPending || plannedQuery.isPending
  const issues = issuesQuery.data?.issues || []
  const urgents = urgentsQuery.data?.items || []
  const planned = plannedQuery.data?.items || []

  const openIssues = issues.filter((entry) => entry.status !== 'done')
  const openUrgents = urgents.filter((entry) => entry.status !== 'completata')
  const todayInterventions = planned.filter((entry) => entry.status !== 'done' && (
    isToday(entry.scheduledAt)
    || (entry.scheduledAt && entry.scheduledUntil && entry.scheduledAt <= Date.now() && entry.scheduledUntil >= Date.now())
  ))
  const recent = [...issues].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 4)

  const weather = weatherQuery.data
  const weatherVisual = weatherQuery.isError
    ? { icon: '⚪', title: 'Meteo', message: 'Meteo non disponibile', tone: 'muted' }
    : weather?.level === 'danger'
      ? { icon: '🌬️', title: 'ALLARME METEO', message: weather.message || 'Chiudere gli ombrelloni', tone: 'danger' }
      : weather?.level === 'warning'
        ? { icon: weather?.rainProbability >= 60 ? '🌧️' : '💨', title: 'Attenzione meteo', message: weather.message || 'Controllare gli esterni', tone: 'warning' }
        : { icon: '☀️', title: 'Meteo OK', message: 'Nessuna azione richiesta', tone: 'ok' }

  const widgetData = useMemo(() => ({
    issues: { count: openIssues.length, message: openIssues.length ? 'Da gestire' : 'Tutto in ordine' },
    urgent: { count: openUrgents.length, message: openUrgents.length ? 'Richiedono azione' : 'Nessun avviso' },
    interventions: { count: todayInterventions.length, message: 'Pianificati' },
  }), [openIssues.length, openUrgents.length, todayInterventions.length])

  return (
    <div data-testid="home-view" className={editing ? 'rs-home rs-widget-home is-editing' : 'rs-home rs-widget-home'}>
      <style>{HOME_STYLES}</style>
      <section className="rs-hero">
        <h1>Ciao, {firstName(user?.name)}</h1>
        <p>{hotel.name} · ecco la situazione di oggi</p>
      </section>

      {loading ? <Spinner label="Carico i dati della struttura…" /> : <>
        <WidgetDashboard
          user={user}
          hotel={hotel}
          editing={editing}
          setEditing={setEditing}
          widgetData={widgetData}
          weatherVisual={weatherVisual}
          onNavigate={onNavigate}
        />

        <Card className="rs-card--pad rs-home-activity">
          <div className="rs-section__head"><h2>Attività recenti</h2></div>
          {recent.length === 0
            ? <p style={{ margin: 0, color: 'var(--rs-text-2)' }}>Nessuna segnalazione registrata.</p>
            : <div className="rs-list">{recent.map((issue) => (
              <button key={issue.id} className="rs-issue rs-home-recent" onClick={() => onNavigate?.('issues')}>
                <span className={`rs-issue__accent ${URGENCY_META[issue.urgency]?.tone || 'mid'}`} />
                <span className="rs-issue__main">
                  <span className="rs-issue__room">{issue.room}</span>
                  <span className="rs-issue__title">{issue.title}</span>
                </span>
              </button>
            ))}</div>}
        </Card>
      </>}
    </div>
  )
}

function WidgetDashboard({ user, hotel, editing, setEditing, widgetData, weatherVisual, onNavigate }) {
  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 420 })
  const deviceClass = useDeviceClass()
  const layout = useWidgetStore((state) => state.layout)
  const hydrate = useWidgetStore((state) => state.hydrate)
  const setLayout = useWidgetStore((state) => state.setLayout)
  const reset = useWidgetStore((state) => state.reset)

  const storageKey = `randapp.home.widget-engine.v5:${user?.id || user?.name || 'user'}:${hotel.id}:${deviceClass}`

  useEffect(() => {
    hydrate(storageKey)
  }, [hydrate, storageKey])

  const visibleIds = layout.map((entry) => entry.i)
  const hiddenIds = WIDGET_IDS.filter((id) => !visibleIds.includes(id))

  const changeSize = (id, w) => {
    setLayout((current) => current.map((entry) => entry.i === id
      ? { ...entry, w, x: Math.min(entry.x, COLS - w) }
      : entry))
  }

  const removeWidget = (id) => {
    if (layout.length <= 1) return
    setLayout((current) => current.filter((entry) => entry.i !== id))
  }

  const addWidget = (id) => {
    if (visibleIds.includes(id) || layout.length >= 9) return
    setLayout((current) => [...current, item(id, 0, Math.min(MAX_ROWS - 1, 2), 1, 1)])
  }

  return <>
    {editing && <div className="rs-widget-toolbar">
      <button type="button" className="rs-widget-toolbar__button" onClick={reset}><RotateCcw size={17} /> Ripristina</button>
      <button type="button" className="rs-widget-toolbar__button is-primary" onClick={() => setEditing(false)}>Fine</button>
    </div>}

    <div ref={containerRef} className="rs-widget-grid-shell" data-testid="home-stats">
      {mounted && <ReactGridLayout
        width={width}
        layout={layout}
        gridConfig={{ cols: COLS, rowHeight: 126, margin: [10, 10], containerPadding: [0, 0], maxRows: MAX_ROWS }}
        dragConfig={{ enabled: editing, handle: '.rs-widget-drag', cancel: 'button,.rs-widget-action', bounded: true, allowMobileScroll: true }}
        resizeConfig={{ enabled: editing, handles: ['se'] }}
        compactor={verticalCompactor}
        onLayoutChange={(next) => setLayout(next.map((entry) => ({ ...entry })))}
      >
        {layout.map((entry) => <div key={entry.i} className="rs-widget-grid-item">
          <WidgetFrame
            id={entry.i}
            layoutItem={entry}
            editing={editing}
            onSize={changeSize}
            onRemove={removeWidget}
          >
            <WidgetContent
              id={entry.i}
              size={sizeName(entry.w)}
              data={widgetData[entry.i]}
              weatherVisual={weatherVisual}
              editing={editing}
              user={user}
              onNavigate={onNavigate}
            />
          </WidgetFrame>
        </div>)}
      </ReactGridLayout>}
    </div>

    {editing && <div className="rs-widget-catalog">
      <div className="rs-widget-catalog__head"><LayoutGrid size={18} /><div><strong>Widget disponibili</strong><span>Trascina e ridimensiona. S, M e L cambiano automaticamente il contenuto.</span></div></div>
      {hiddenIds.length
        ? <div className="rs-widget-catalog__list">{hiddenIds.map((id) => <button key={id} type="button" onClick={() => addWidget(id)}><Plus size={16} /> {WIDGET_TITLES[id]}</button>)}</div>
        : <p>Tutti i widget disponibili sono già nella Home.</p>}
    </div>}
  </>
}

function WidgetFrame({ id, layoutItem, editing, onSize, onRemove, children }) {
  return <div className={`rs-widget-frame rs-widget-frame--${sizeName(layoutItem.w).toLowerCase()}`}>
    {editing && <div className="rs-widget-editbar">
      <span className="rs-widget-drag" title="Trascina"><GripVertical size={18} /></span>
      <div className="rs-widget-sizes" aria-label={`Dimensione ${WIDGET_TITLES[id]}`}>
        {[1, 2, 3].map((w) => <button key={w} type="button" className={layoutItem.w === w ? 'is-active' : ''} onClick={() => onSize(id, w)}>{sizeName(w)}</button>)}
      </div>
      <button type="button" className="rs-widget-remove" onClick={() => onRemove(id)} aria-label={`Rimuovi ${WIDGET_TITLES[id]}`}><X size={16} /></button>
    </div>}
    {children}
  </div>
}

function WidgetContent({ id, size, data, weatherVisual, editing, user, onNavigate }) {
  if (id === 'quick') return <QuickActions size={size} user={user} onNavigate={onNavigate} />
  if (id === 'weather') return <WeatherWidget size={size} visual={weatherVisual} />

  const config = {
    issues: { icon: ClipboardList, title: 'Segnalazioni', route: 'issues', tone: 'cyan' },
    urgent: { icon: AlertTriangle, title: 'Urgenti', route: 'urgent', tone: 'amber' },
    interventions: { icon: Wrench, title: 'Interventi', route: 'interventions', tone: 'blue' },
  }[id]
  if (!config) return null
  const Icon = config.icon

  return <Card as="button" className={`rs-widget-card rs-widget-stat rs-widget-stat--${config.tone} rs-widget-card--${size.toLowerCase()}`} onClick={() => !editing && onNavigate?.(config.route)} data-testid={`stat-${id}`}>
    <span className="rs-widget-stat__icon"><Icon size={size === 'S' ? 20 : 24} /></span>
    <strong className="rs-widget-stat__count">{data?.count ?? 0}</strong>
    <span className="rs-widget-stat__title">{config.title}</span>
    {size !== 'S' && <span className="rs-widget-stat__message">{data?.message}</span>}
  </Card>
}

function WeatherWidget({ size, visual }) {
  return <Card className={`rs-widget-card rs-widget-weather rs-widget-weather--${visual.tone} rs-widget-card--${size.toLowerCase()}`} data-testid="weather-widget">
    <span className="rs-widget-weather__icon">{visual.icon}</span>
    <strong>{size === 'S' && visual.title === 'Meteo OK' ? 'Meteo OK' : visual.title}</strong>
    {size !== 'S' && <span>{visual.message}</span>}
    {size === 'L' && <span className="rs-widget-weather__hint"><CloudSun size={15} /> controllo automatico attivo</span>}
  </Card>
}

function QuickActions({ size, user, onNavigate }) {
  const actions = [
    can(user, 'create') ? { icon: Plus, label: 'Nuova segnalazione', short: 'Nuova', route: 'issues', accent: true } : null,
    { icon: AlertTriangle, label: 'Urgenti', short: 'Urgenti', route: 'urgent' },
    { icon: Wrench, label: 'Interventi', short: 'Interventi', route: 'interventions' },
  ].filter(Boolean)

  return <Card className={`rs-widget-card rs-widget-quick rs-widget-card--${size.toLowerCase()}`}>
    {size === 'L' && <strong className="rs-widget-quick__title">Azioni rapide</strong>}
    <div className={`rs-widget-quick__actions rs-widget-quick__actions--${size.toLowerCase()}`}>
      {actions.map(({ icon: ActionIcon, label, short, route, accent }) => <button key={route + label} type="button" className={accent ? 'is-accent' : ''} onClick={() => onNavigate?.(route)} aria-label={label}>
        <ActionIcon size={size === 'S' ? 20 : 18} />
        {size !== 'S' && <span>{size === 'M' ? short : label}</span>}
      </button>)}
    </div>
  </Card>
}

const HOME_STYLES = `
  .rs-widget-home{--wg-gap:clamp(8px,1.4vw,12px)}
  .rs-widget-toolbar{display:flex;justify-content:flex-end;gap:8px;margin:0 0 12px}
  .rs-widget-toolbar__button{display:inline-flex;align-items:center;gap:7px;min-height:42px;padding:8px 12px;border:1px solid var(--rs-border);border-radius:12px;background:var(--rs-surface);color:var(--rs-text);font:inherit;font-weight:700}
  .rs-widget-toolbar__button.is-primary{background:var(--rs-accent);color:#fff;border-color:transparent}
  .rs-widget-grid-shell{width:100%;min-height:126px}
  .react-grid-layout{position:relative;transition:height .2s ease}
  .react-grid-item{transition:all .18s ease}
  .react-grid-item.react-grid-placeholder{background:color-mix(in srgb,var(--rs-accent) 22%,transparent);border-radius:18px;opacity:.8}
  .react-grid-item>.react-resizable-handle{opacity:0;transition:opacity .15s ease}
  .is-editing .react-grid-item>.react-resizable-handle{opacity:1}
  .rs-widget-grid-item,.rs-widget-frame{height:100%;min-width:0}
  .rs-widget-frame{position:relative}
  .rs-widget-frame>.rs-widget-card{width:100%;height:100%;min-height:0;margin:0;overflow:hidden}
  .rs-widget-editbar{position:absolute;z-index:6;top:6px;left:6px;right:6px;display:flex;align-items:center;gap:6px;height:32px;padding:3px 4px;border:1px solid var(--rs-border);border-radius:10px;background:color-mix(in srgb,var(--rs-surface) 92%,transparent);backdrop-filter:blur(10px)}
  .rs-widget-drag{display:grid;place-items:center;width:27px;height:27px;cursor:grab;color:var(--rs-text-2)}
  .rs-widget-sizes{display:flex;gap:3px;margin-left:auto}
  .rs-widget-sizes button,.rs-widget-remove{display:grid;place-items:center;width:26px;height:26px;border:0;border-radius:7px;background:transparent;color:var(--rs-text-2);font:inherit;font-size:.72rem;font-weight:800}
  .rs-widget-sizes button.is-active{background:var(--rs-accent);color:#fff}
  .rs-widget-remove{color:#d95b64}
  .is-editing .rs-widget-card{padding-top:44px!important}
  .rs-widget-card{border-radius:clamp(15px,2vw,20px)!important}
  .rs-widget-stat{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto 1fr;align-content:center;column-gap:10px;text-align:left!important;padding:clamp(12px,2.2vw,20px)!important}
  .rs-widget-stat__icon{grid-row:1/3;display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:color-mix(in srgb,var(--rs-accent) 12%,transparent);color:var(--rs-accent)}
  .rs-widget-stat--amber .rs-widget-stat__icon{background:rgba(245,158,11,.12);color:#d98700}.rs-widget-stat--blue .rs-widget-stat__icon{background:rgba(59,130,246,.12);color:#3b82f6}
  .rs-widget-stat__count{font-size:clamp(1.6rem,4vw,2.6rem);line-height:.95}.rs-widget-stat__title{font-weight:800;font-size:clamp(.78rem,1.8vw,.98rem)}.rs-widget-stat__message{grid-column:1/-1;align-self:end;color:var(--rs-text-2);font-size:.78rem}
  .rs-widget-card--s.rs-widget-stat{grid-template-columns:auto 1fr;grid-template-rows:1fr auto;padding:12px!important}.rs-widget-card--s .rs-widget-stat__icon{grid-row:1;align-self:start;width:34px;height:34px}.rs-widget-card--s .rs-widget-stat__count{justify-self:end;align-self:start;font-size:1.75rem}.rs-widget-card--s .rs-widget-stat__title{grid-column:1/-1;align-self:end;font-size:.78rem}
  .rs-widget-weather{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;text-align:center!important;padding:12px!important}.rs-widget-weather__icon{font-size:2rem;line-height:1}.rs-widget-weather strong{font-size:clamp(.78rem,2vw,1rem)}.rs-widget-weather>span:not(.rs-widget-weather__icon){font-size:.72rem;color:var(--rs-text-2);line-height:1.2}.rs-widget-weather__hint{display:flex;align-items:center;gap:5px}.rs-widget-weather--warning{box-shadow:inset 0 0 0 1px rgba(245,158,11,.55)}.rs-widget-weather--danger{box-shadow:inset 0 0 0 2px rgba(239,68,68,.7)}.rs-widget-weather--muted{opacity:.82}
  .rs-widget-quick{display:flex;flex-direction:column;justify-content:center;gap:9px;padding:12px!important}.rs-widget-quick__title{font-size:.9rem}.rs-widget-quick__actions{display:grid;gap:7px}.rs-widget-quick__actions--s{grid-template-columns:repeat(3,1fr)}.rs-widget-quick__actions--m{grid-template-columns:repeat(3,minmax(0,1fr))}.rs-widget-quick__actions--l{grid-template-columns:repeat(3,minmax(0,1fr))}
  .rs-widget-quick__actions button{min-width:0;min-height:42px;border:1px solid var(--rs-border);border-radius:11px;background:var(--rs-surface-2,var(--rs-surface));color:var(--rs-text);display:flex;align-items:center;justify-content:center;gap:6px;padding:7px;font:inherit;font-size:.74rem;font-weight:750;white-space:nowrap;overflow:hidden}.rs-widget-quick__actions button.is-accent{background:var(--rs-accent);border-color:transparent;color:#fff}.rs-widget-quick__actions--s button{padding:0}
  .rs-widget-catalog{margin-top:14px;padding:13px;border:1px dashed var(--rs-border);border-radius:15px}.rs-widget-catalog__head{display:flex;gap:9px;align-items:flex-start}.rs-widget-catalog__head>div{display:flex;flex-direction:column;gap:2px}.rs-widget-catalog__head span,.rs-widget-catalog p{font-size:.76rem;color:var(--rs-text-2)}.rs-widget-catalog__list{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.rs-widget-catalog__list button{display:flex;align-items:center;gap:6px;min-height:40px;padding:8px 10px;border:1px solid var(--rs-border);border-radius:11px;background:var(--rs-surface);color:var(--rs-text);font:inherit;font-weight:700}
  .rs-home-activity{margin-top:clamp(14px,2.4vw,22px)}.rs-home-recent{width:100%;border:0;background:transparent;color:inherit;text-align:left}
  @media(max-width:520px){.rs-widget-home .rs-hero{margin-bottom:14px}.rs-widget-grid-shell{margin-inline:-2px;width:calc(100% + 4px)}.rs-widget-stat{column-gap:6px}.rs-widget-quick__actions button{font-size:.68rem}.rs-widget-card--m .rs-widget-quick__actions button span{max-width:64px;overflow:hidden;text-overflow:ellipsis}.rs-widget-editbar{left:4px;right:4px}.rs-widget-sizes button,.rs-widget-remove{width:24px;height:24px}}
`

export default function Home(props) {
  return <QueryClientProvider client={queryClient}><HomeData {...props} /></QueryClientProvider>
}
